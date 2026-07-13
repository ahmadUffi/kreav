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
import { HorizonService } from './horizon.service';
import { USDC_DECIMALS } from './stellar.config';

/** Mirrors the contract's MAX_RECIPIENTS — settle() rejects vectors above 10. */
const MAX_RECIPIENTS = 10;

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
    private readonly horizon: HorizonService,
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
          txHash: true,
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

      // Mirror the contract's MAX_RECIPIENTS guard so an oversized collaborator
      // list fails with a clear log instead of an opaque simulation error.
      if (collaborators.length > MAX_RECIPIENTS) {
        this.logger.error(
          `Product ${order.productId} has ${collaborators.length} active collaborators — ` +
            `contract supports at most ${MAX_RECIPIENTS}. Cannot settle.`,
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

      // ── Step 3b: Recipient trustline pre-check ──────────────────────
      // `settle` is atomic: if ANY recipient lacks a USDC trustline, the SAC
      // transfer reverts (op_no_trust) and the whole settlement fails on-chain —
      // burning the fee and blocking every other collaborator. Check first so we
      // fail fast with an actionable reason instead of an opaque on-chain revert.
      // Degrade soft: if a Horizon read errors (network), proceed — the contract
      // remains the authoritative guard.
      const missingTrustline = await this.findRecipientsMissingTrustline(recipients);
      if (missingTrustline.length > 0) {
        this.logger.error(
          `RECIPIENT_NO_TRUSTLINE (order=${orderId}): ` +
            `${missingTrustline.length} recipient(s) lack a USDC trustline ` +
            `[${missingTrustline.map((a) => a.slice(0, 8) + '...').join(', ')}]. ` +
            'They must activate USDC (POST /wallets/trustline/prepare) before settling.',
        );
        await this.prisma.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.SETTLEMENT_FAILED },
        });
        return;
      }

      // ── Step 4: Scale to base units (× 10^7) ────────────────────────
      // amountUsd is a decimal string like "10.00"
      const totalAmountBase = BigInt(
        new Prisma.Decimal(amountUsd).mul(10 ** USDC_DECIMALS).toFixed(0),
      );

      // ── Step 4b: On-chain idempotency pre-check ─────────────────────
      // Contract doc (is_settled): "The backend calls this before submitting
      // a new settlement transaction, and before retrying a failed one."
      // Without it, a retry of an already-settled order fails with
      // OrderAlreadySettled and the order is WRONGLY marked SETTLEMENT_FAILED
      // even though the money moved. Degrade soft: if the read itself fails
      // (RPC down / contract unset), proceed — the contract remains the
      // authoritative guard.
      let alreadySettled = false;
      try {
        alreadySettled = await this.sorobanRpc.isSettled(orderId);
      } catch (err) {
        this.logger.warn(
          `is_settled pre-check failed (order=${orderId}) — proceeding with invoke: ` +
            (err instanceof Error ? err.message : String(err)),
        );
      }
      if (alreadySettled) {
        await this.recoverAlreadySettled(
          orderId,
          amountUsd,
          totalAmountBase,
          order.txHash,
          recipients,
          collaborators,
        );
        return;
      }

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
   * Return the subset of recipient addresses that do NOT have a USDC trustline.
   *
   * Reads each recipient's account state from Horizon. If a read throws
   * (network/Horizon error) we treat that recipient as OK (soft degrade) and let
   * the contract's atomic transfer be the final guard — we never block a
   * settlement on a transient read failure.
   */
  private async findRecipientsMissingTrustline(recipients: RecipientInput[]): Promise<string[]> {
    const checks = await Promise.all(
      recipients.map(async (r) => {
        try {
          const state = await this.horizon.getUsdcBalance(r.address);
          return state.hasUsdcTrustline ? null : r.address;
        } catch (err) {
          this.logger.warn(
            `Trustline pre-check failed for ${r.address.slice(0, 8)}... — assuming OK: ` +
              (err instanceof Error ? err.message : String(err)),
          );
          return null;
        }
      }),
    );
    return checks.filter((a): a is string => a !== null);
  }

  /**
   * Recover DB state for an order that is ALREADY settled on-chain
   * (is_settled pre-check returned true) — e.g. after a crash between the
   * on-chain success and the DB write, or a re-emitted payment.received.
   *
   * - Settlement row already present → just transition the order to SETTLED.
   * - No row but we know the txHash    → record the settlement normally.
   * - No row and no txHash             → transition to SETTLED + loud warning
   *   (Settlement.txHash is NOT NULL, so the row needs manual reconciliation).
   */
  private async recoverAlreadySettled(
    orderId: string,
    amountUsd: string,
    totalAmountBase: bigint,
    knownTxHash: string | null,
    recipients: RecipientInput[],
    collaborators: { walletAddress: string; role: string; revenuePercentage: Prisma.Decimal }[],
  ): Promise<void> {
    this.logger.warn(
      `Order ${orderId} is already settled on-chain — recovering DB state instead of re-invoking.`,
    );

    const existing = await this.prisma.settlement.findUnique({
      where: { orderId },
      select: { id: true, txHash: true },
    });

    if (existing) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.SETTLED, txHash: existing.txHash },
      });
      this.logger.log(`Order ${orderId} marked SETTLED (settlement row already existed).`);
      return;
    }

    if (knownTxHash) {
      await this.recordSettlementSuccess(
        orderId,
        amountUsd,
        totalAmountBase,
        knownTxHash,
        recipients,
        collaborators,
      );
      return;
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.SETTLED },
    });
    this.logger.warn(
      `Order ${orderId} marked SETTLED but no txHash is known — Settlement row NOT created. ` +
        'Reconcile manually from the contract events (SettlementExecuted).',
    );
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

    // Per-recipient amounts — EXACTLY the contract's algorithm: every
    // recipient gets floor(pool × share / 10000) except the LAST, who gets
    // the remainder (absorbing the rounding dust). Keeping the mirror
    // bit-identical to `calculate_creator_amounts` in smartcontract/src/lib.rs.
    let distributedBase = 0n;
    const creatorAmountsBase = recipients.map((r, i) => {
      if (i === recipients.length - 1) {
        return creatorPoolBase - distributedBase;
      }
      const amountBase = (creatorPoolBase * BigInt(r.shareBps)) / 10000n;
      distributedBase += amountBase;
      return amountBase;
    });

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
            ...recipients.map((r, i) => ({
              walletAddress: r.address,
              recipientType: RecipientType.CREATOR,
              role: collaborators[i]?.role ?? 'Creator',
              percentage: collaborators[i]?.revenuePercentage ?? new Prisma.Decimal(0),
              amount: new Prisma.Decimal(creatorAmountsBase[i].toString()).div(10 ** USDC_DECIMALS),
            })),
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
