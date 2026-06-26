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
  async checkout(productId: string): Promise<{ orderId: string }> {
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
        // Buyer is anonymous in the demo (Filipino buyer via GCash). A real
        // email would come from auth; a placeholder keeps the column NOT NULL.
        buyerEmail: `buyer+${Date.now()}@kreav.test`,
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
}
