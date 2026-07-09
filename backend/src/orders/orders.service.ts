import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppEvents } from '../events/event-names';
import type {
  PaymentReceivedPayload,
  WalletConnectRequiredPayload,
} from '../events/event-payloads';
import { canTransition } from './order-state-machine';
import { InvalidStateTransitionException } from './invalid-transition.exception';

/**
 * OrdersService — checkout + mock GCash payment webhook (BE-005).
 *
 * Money: `amountUsd` is read as a Prisma.Decimal from the product and written
 * as a fresh Decimal to the order (never shared by reference). On webhook, it's
 * emitted as a decimal string in the event payload — matching the
 * DecimalToStringInterceptor convention.
 *
 * Idempotency: a duplicate `paymentRef` (Payment Transaction ID) is detected
 * before any state change and silently ignored — no re-emit, no double-settle.
 * Backed by the unique index on `Order.paymentRef` (BE-003).
 *
 * Source: Kreav Backend PRD v3 §9 + v3.1 §20 (state machine, idempotency,
 * WAITING_WALLET).
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emitter: EventEmitter2,
  ) {}

  /**
   * POST /checkout — create an order for a product.
   *
   * The order is created at CHECKOUT_STARTED, then immediately advanced to
   * PAYMENT_PENDING — modeling the buyer being redirected to the payment
   * provider (GCash). The webhook later drives PAYMENT_PENDING → PAYMENT_RECEIVED.
   */
  async checkout(productId: string, buyerEmail: string): Promise<{ orderId: string }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { priceUsd: true, creatorId: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const order = await this.prisma.order.create({
      data: {
        productId,
        // The buyer's email is captured at checkout — it's where the product
        // download link is delivered after settlement (product-delivery listener).
        buyerEmail,
        // Fresh Decimal — do NOT store the product's reference, or a later
        // mutation could corrupt the source row.
        amountUsd: new Prisma.Decimal(product.priceUsd.toFixed(2)),
        status: OrderStatus.PAYMENT_PENDING,
      },
      select: { id: true },
    });

    return { orderId: order.id };
  }

  /**
   * POST /webhooks/gcash — confirm a payment.
   * Idempotent on `paymentRef`; defers to WAITING_WALLET if the creator has no
   * connected wallet. Emits the appropriate event and returns fast.
   */
  async handleGcashPayment(
    orderId: string,
    paymentRef: string,
  ): Promise<{ status: 'paid'; orderId: string }> {
    // --- Idempotency check: has ANY order already claimed this paymentRef? ---
    const existing = await this.prisma.order.findFirst({
      where: { paymentRef },
      select: { id: true },
    });
    if (existing) {
      // Duplicate webhook — acknowledge silently, no re-emit, no state change.
      return { status: 'paid', orderId };
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        amountUsd: true,
        paymentRef: true,
        product: { select: { creatorId: true } },
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // --- Transition guard: the primary webhook transition is PAYMENT_PENDING →
    // PAYMENT_RECEIVED. WAITING_WALLET is a deferral *from* PAYMENT_RECEIVED,
    // so we validate the primary hop here and then write the final state. ---
    if (!canTransition(order.status, OrderStatus.PAYMENT_RECEIVED)) {
      throw new InvalidStateTransitionException(order.status, OrderStatus.PAYMENT_RECEIVED);
    }

    const amountUsd = order.amountUsd.toFixed(2);
    const creatorId = order.product.creatorId;

    // --- Does the creator have a connected wallet? ---
    const wallet = await this.prisma.wallet.findFirst({
      where: { creatorId },
      select: { walletAddress: true },
    });

    if (!wallet) {
      // WAITING_WALLET — defer settlement until the wallet is connected.
      // Legal because PAYMENT_RECEIVED → WAITING_WALLET (validated above hop).
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.WAITING_WALLET, paymentRef },
      });

      const payload: WalletConnectRequiredPayload = {
        orderId,
        creatorId,
        amountUsd,
        paymentRef,
      };
      this.emitter.emit(AppEvents.WalletConnectRequired, payload);
      return { status: 'paid', orderId };
    }

    // --- Happy path: payment received, wallet present → emit payment.received. ---
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PAYMENT_RECEIVED, paymentRef },
    });

    const payload: PaymentReceivedPayload = {
      orderId,
      amountUsd,
      creatorId,
      walletAddress: wallet.walletAddress,
      paymentRef,
    };
    this.emitter.emit(AppEvents.PaymentReceived, payload);
    return { status: 'paid', orderId };
  }

  // ── BE-018: Read endpoints ───────────────────────────────────────────────

  /**
   * GET /orders — paginated list, optionally filtered by creator.
   *
   * Joins with Product to return the product title and price.
   * Ordered newest-first.
   */
  async findAll(query: { creatorId?: string; page: number; limit: number }): Promise<{
    data: Array<Record<string, unknown>>;
    page: number;
    limit: number;
    total: number;
  }> {
    const { creatorId, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};
    if (creatorId) {
      where.product = { creatorId };
    }

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        skip,
        take: limit,
        where,
        include: {
          product: {
            select: { title: true, priceUsd: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    const data = rows.map((row) => ({
      id: row.id,
      productTitle: row.product.title,
      productPrice: row.product.priceUsd?.toFixed?.(2) ?? String(row.product.priceUsd),
      buyerEmail: row.buyerEmail,
      amountUsd: row.amountUsd?.toFixed?.(2) ?? String(row.amountUsd),
      status: row.status,
      paymentRef: row.paymentRef ?? undefined,
      txHash: row.txHash ?? undefined,
      createdAt:
        row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    }));

    return { data, page, limit, total };
  }

  /**
   * GET /orders/:id — single order with product details.
   * Throws 404 if not found.
   */
  async findOne(id: string): Promise<Record<string, unknown>> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        product: {
          select: { id: true, title: true, priceUsd: true },
        },
        settlement: {
          select: {
            id: true,
            txHash: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      id: order.id,
      productId: order.product.id,
      productTitle: order.product.title,
      productPrice: order.product.priceUsd?.toFixed?.(2) ?? String(order.product.priceUsd),
      buyerEmail: order.buyerEmail,
      amountUsd: order.amountUsd?.toFixed?.(2) ?? String(order.amountUsd),
      status: order.status,
      paymentRef: order.paymentRef ?? undefined,
      txHash: order.txHash ?? undefined,
      settlement: order.settlement
        ? {
            id: order.settlement.id,
            txHash: order.settlement.txHash,
            totalAmount:
              order.settlement.totalAmount?.toFixed?.(2) ?? String(order.settlement.totalAmount),
            status: order.settlement.status,
            createdAt:
              order.settlement.createdAt instanceof Date
                ? order.settlement.createdAt.toISOString()
                : String(order.settlement.createdAt),
          }
        : undefined,
      createdAt:
        order.createdAt instanceof Date ? order.createdAt.toISOString() : String(order.createdAt),
    };
  }
}
