import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderStatus, Prisma, RecipientType, SettlementStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppEvents } from '../events/event-names';
import type { PaymentReceivedPayload, SettlementCompletedPayload } from '../events/event-payloads';
import { canTransition } from '../orders/order-state-machine';
import { InvalidStateTransitionException } from '../orders/invalid-transition.exception';
import {
  RecipientInput,
  SorobanRpcService,
  SettlementSimulationError,
  SettlementSubmissionError,
  SettlementTimeoutError,
} from './soroban-rpc.service';
import { USDC_DECIMALS } from './stellar.config';

/**
 * SettlementService — BE-007 core.
 *
 * Consumes `payment.received` events from OrdersService (BE-005), orchestrates
 * the Soroban settlement, and records the result in PostgreSQL.
 *
 * ## Money-split responsibility
 * The contract is the AUTHORITATIVE split executor. This service mirrors the
 * same arithmetic for DB recording — it NEVER re-computes or overrides the
 * contract's output. If the contract succeeds, the DB mirrors its result.
 * If the contract fails, no money moved and the Order goes to SETTLEMENT_FAILED.
 *
 * ## Decimal scaling
 * DB stores Decimal(18,2) — e.g. "10.00"
 * Contract expects i128 base units (7 decimals) — e.g. 100_000_000
 * Conversion: amount_base = amount_usd × 10^7
 *
 * ## State machine transitions used
 *   PAYMENT_RECEIVED → SETTLEMENT_PENDING  (start)
 *   SETTLEMENT_PENDING → SETTLED            (on-chain success)
 *   SETTLEMENT_PENDING → SETTLEMENT_FAILED  (on-chain failure / sim error)
 *
 * Source: docs/backend/Backend-PRD.md §10 + canonical Soroban contract.
 */
@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emitter: EventEmitter2,
    private readonly sorobanRpc: SorobanRpcService,
  ) {}

  /**
   * Handle a `payment.received` event.
   *
   * The flow:
   *   1. Transition Order to SETTLEMENT_PENDING.
   *   2. Load + validate ProductCollaborator rows (must sum to 100%).
   *   3. Build RecipientInput[] (address + shareBps in i128).
   *   4. Scale amountUsd to base units (×10^7).
   *   5. Call SorobanRpcService.invokeSettle().
   *   6. On SUCCESS: record Settlement + SettlementRecipient rows, emit completed.
   *   7. On failure: transition to SETTLEMENT_FAILED, log error.
   *
   * Idempotency: `order_ref` must be unique per the contract — duplicate calls
   * with the same order_ref are rejected by the contract with a
   * `Result::Err(ContractError::OrderAlreadySettled)`, which fails the
   * transaction → SETTLEMENT_FAILED.
   */
  @OnEvent(AppEvents.PaymentReceived)
  async handlePaymentReceived(payload: PaymentReceivedPayload): Promise<void> {
    const { orderId, amountUsd } = payload;
    this.logger.log(`payment.received for order=${orderId}, amount=${amountUsd}`);

    try {
      // ── Step 1: Transition to SETTLEMENT_PENDING ────────────────────
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          productId: true,
          amountUsd: true,
        },
      });

      if (!order) {
        this.logger.error(`Order ${orderId} not found — cannot settle`);
        return;
      }

      if (!canTransition(order.status, OrderStatus.SETTLEMENT_PENDING)) {
        throw new InvalidStateTransitionException(order.status, OrderStatus.SETTLEMENT_PENDING);
      }

      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.SETTLEMENT_PENDING },
      });

      // ── Step 2: Load + validate collaborators ───────────────────────
      const collaborators = await this.prisma.productCollaborator.findMany({
        where: {
          productId: order.productId,
          status: 'ACTIVE',
        },
        select: {
          walletAddress: true,
          role: true,
          revenuePercentage: true,
        },
      });

      if (collaborators.length === 0) {
        this.logger.error(`Product ${order.productId} has no active collaborators — cannot settle`);
        await this.prisma.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.SETTLEMENT_FAILED },
        });
        return;
      }

      // Validate revenue percentages sum to 100.00
      const sumPercentages = collaborators.reduce(
        (acc, c) => acc.plus(c.revenuePercentage),
        new Prisma.Decimal(0),
      );
      if (!sumPercentages.equals(100.0)) {
        this.logger.error(
          `Collaborator revenue percentages sum to ${sumPercentages.toString()}, not 100.00`,
        );
        await this.prisma.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.SETTLEMENT_FAILED },
        });
        return;
      }

      // ── Step 3: Build RecipientInput[] ──────────────────────────────
      // shareBps = revenuePercentage * 100 (e.g. 70.50% → 7050 bps)
      const recipients: RecipientInput[] = collaborators.map((c) => ({
        address: c.walletAddress,
        shareBps: c.revenuePercentage.mul(100).toNumber(), // Decimal(5,2) → bps
      }));

      // ── Step 4: Scale to base units (× 10^7) ────────────────────────
      // amountUsd is a decimal string like "10.00"
      const totalAmountBase = BigInt(
        new Prisma.Decimal(amountUsd).mul(10 ** USDC_DECIMALS).toFixed(0),
      );

      // ── Step 5: Invoke settlement ───────────────────────────────────
      const result = await this.sorobanRpc.invokeSettle(
        orderId, // order_ref = Order.id (UUID)
        totalAmountBase,
        recipients,
      );

      // ── Step 6a: SUCCESS — record settlement ────────────────────────
      if (result.status === 'SUCCESS') {
        await this.recordSettlementSuccess(
          orderId,
          amountUsd,
          totalAmountBase,
          result.txHash,
          recipients,
          collaborators,
        );
        return;
      }

      // ── Step 6b: FAILED (on-chain revert) ───────────────────────────
      this.logger.error(
        `Settlement FAILED on-chain (order=${orderId}, txHash=${result.txHash}): ` +
          (result.errorResultXdr ?? 'unknown error'),
      );
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.SETTLEMENT_FAILED,
          txHash: result.txHash,
        },
      });
    } catch (err) {
      await this.handleSettlementError(orderId, err);
    }
  }

  /**
   * Record a successful settlement in PostgreSQL.
   *
   * Creates one Settlement row + (N collaborators + 1 Platform) SettlementRecipient rows.
   *
   * The settlement amounts are computed using the same integer-division formula
   * as the contract (BigInt math). The DB mirrors the contract's authoritative
   * result — it does NOT re-compute or override it.
   */
  private async recordSettlementSuccess(
    orderId: string,
    amountUsd: string,
    totalAmountBase: bigint,
    txHash: string,
    recipients: RecipientInput[],
    collaborators: { walletAddress: string; role: string; revenuePercentage: Prisma.Decimal }[],
  ): Promise<void> {
    // Compute the split using the same integer division as the contract.
    //   platform_fee  = total * 500 / 10000
    //   creator_pool  = total - platform_fee
    const platformFeeBase = (totalAmountBase * 500n) / 10000n;
    const creatorPoolBase = totalAmountBase - platformFeeBase;

    // Convert back to USD for the Settlement rows
    const totalAmountDecimal = new Prisma.Decimal(amountUsd);
    const platformFeeDecimal = new Prisma.Decimal(platformFeeBase.toString()).div(
      10 ** USDC_DECIMALS,
    );
    const creatorPoolDecimal = new Prisma.Decimal(creatorPoolBase.toString()).div(
      10 ** USDC_DECIMALS,
    );

    // Create the Settlement row
    await this.prisma.settlement.create({
      data: {
        orderId,
        totalAmount: totalAmountDecimal,
        txHash,
        status: SettlementStatus.COMPLETED,
        recipients: {
          create: [
            // Platform fee row (RecipientType.PLATFORM)
            {
              walletAddress: '', // Filled below after we know the wallet
              recipientType: RecipientType.PLATFORM,
              role: 'Platform Fee',
              percentage: new Prisma.Decimal(5.0),
              amount: platformFeeDecimal,
            },
            // Creator rows (RecipientType.CREATOR)
            ...recipients.map((r, i) => {
              const amountBase = (creatorPoolBase * BigInt(r.shareBps)) / 10000n;
              const amountDecimal = new Prisma.Decimal(amountBase.toString()).div(
                10 ** USDC_DECIMALS,
              );
              return {
                walletAddress: r.address,
                recipientType: RecipientType.CREATOR,
                role: collaborators[i]?.role ?? 'Creator',
                percentage: collaborators[i]?.revenuePercentage ?? new Prisma.Decimal(0),
                amount: amountDecimal,
              };
            }),
          ],
        },
      },
    });

    // Transition the order to SETTLED
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.SETTLED,
        txHash,
      },
    });

    this.logger.log(
      `Settlement COMPLETED (order=${orderId}, txHash=${txHash}): ` +
        `total=${totalAmountDecimal}, fee=${platformFeeDecimal}, creator=${creatorPoolDecimal}`,
    );

    // Emit settlement.completed so downstream consumers (notifications, etc.) react.
    const completedPayload: SettlementCompletedPayload = {
      orderId,
      txHash,
      creatorAmountUsd: creatorPoolDecimal.toFixed(2),
      platformAmountUsd: platformFeeDecimal.toFixed(2),
    };
    this.emitter.emit(AppEvents.SettlementCompleted, completedPayload);
  }

  /**
   * Handle errors from the settlement pipeline.
   *
   * Maps known error types to the appropriate Order status:
   *   - Simulation error / submission error → SETTLEMENT_FAILED
   *   - Timeout → remains SETTLEMENT_PENDING (may confirm later)
   *   - Other → SETTLEMENT_FAILED with logged details
   */
  private async handleSettlementError(orderId: string, err: unknown): Promise<void> {
    if (err instanceof InvalidStateTransitionException) {
      this.logger.error(`Invalid state transition for order ${orderId}: ${err.message}`);
      return;
    }

    if (err instanceof SettlementSimulationError) {
      this.logger.error(
        `Settlement simulation failed for order ${orderId}: ${JSON.stringify(err.details)}`,
      );
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.SETTLEMENT_FAILED },
      });
      return;
    }

    if (err instanceof SettlementSubmissionError) {
      this.logger.error(
        `Settlement submission rejected for order ${orderId}: ${err.errorResultXdr}`,
      );
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.SETTLEMENT_FAILED },
      });
      return;
    }

    if (err instanceof SettlementTimeoutError) {
      // Poll timed out — tx may still confirm later.
      // Leave Order at SETTLEMENT_PENDING; a background recovery job
      // (BC-003, future) or manual reconciliation will resolve it.
      this.logger.warn(
        `Settlement poll timeout for order ${orderId}: txHash=${err.txHash} — ` +
          'transaction may still confirm later.',
      );
      return;
    }

    // Unknown error — log and fail safe.
    this.logger.error(
      `Unexpected settlement error for order ${orderId}: ${err instanceof Error ? err.message : String(err)}`,
    );
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.SETTLEMENT_FAILED },
    });
  }
}
