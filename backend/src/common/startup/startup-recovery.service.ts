import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SorobanRpcService } from '../../stellar/soroban-rpc.service';
import { SettlementService } from '../../stellar/settlement.service';
import { AppEvents } from '../../events/event-names';
import type { PaymentReceivedPayload } from '../../events/event-payloads';

/**
 * Startup Recovery Service — BE-012 (audit #18).
 *
 * The in-process event bus (@nestjs/event-emitter) loses in-flight events when
 * the process crashes between `payment.received` emission and settlement
 * completion. This service recovers those orders on next startup.
 *
 * Recovery logic (runs once on app bootstrap):
 *   1. Query orders stuck in PAYMENT_RECEIVED or SETTLEMENT_PENDING
 *   2. For PAYMENT_RECEIVED: reconstruct + re-emit payment.received
 *   3. For SETTLEMENT_PENDING with txHash: verify via RPC
 *   4. For SETTLEMENT_PENDING without txHash: re-emit payment.received
 *
 * The contract's `order_ref` idempotency guard prevents double settlement.
 *
 * Source: Kreav Security PRD §5 — audit #18.
 */
@Injectable()
export class StartupRecoveryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StartupRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emitter: EventEmitter2,
    private readonly sorobanRpc: SorobanRpcService,
    private readonly settlement: SettlementService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('🔍 Startup recovery — checking for stuck orders...');

    const stuckOrders = await this.prisma.order.findMany({
      where: {
        status: {
          in: [OrderStatus.PAYMENT_RECEIVED, OrderStatus.SETTLEMENT_PENDING],
        },
      },
      select: {
        id: true,
        status: true,
        amountUsd: true,
        paymentRef: true,
        txHash: true,
        product: {
          select: { creatorId: true, title: true },
        },
      },
    });

    if (stuckOrders.length === 0) {
      this.logger.log('✅ No stuck orders found — clean startup.');
      return;
    }

    this.logger.warn(`Found ${stuckOrders.length} stuck order(s) — attempting recovery...`);

    let recovered = 0;
    let failed = 0;

    for (const order of stuckOrders) {
      try {
        const recovered_ = await this.recoverOrder(order);
        if (recovered_) {
          recovered++;
          this.logger.log(
            `  ✅ Recovered order ${order.id} (${order.product?.title ?? 'unknown'})`,
          );
        } else {
          failed++;
          this.logger.warn(`  ⚠️  Could not recover order ${order.id}`);
        }
      } catch (err) {
        failed++;
        this.logger.error(
          `  ❌ Recovery error for order ${order.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    this.logger.log(
      `🏁 Startup recovery complete: ${recovered} recovered, ${failed} failed, ${stuckOrders.length} total`,
    );
  }

  private async recoverOrder(order: {
    id: string;
    status: string;
    amountUsd: Prisma.Decimal;
    paymentRef: string | null;
    txHash: string | null;
    product: { creatorId: string; title: string } | null;
  }): Promise<boolean> {
    if (order.status === OrderStatus.PAYMENT_RECEIVED) {
      return this.recoverPaymentReceived(order);
    }

    if (order.status === OrderStatus.SETTLEMENT_PENDING) {
      return this.recoverSettlementPending(order);
    }

    return false;
  }

  /**
   * Re-emit payment.received for orders that were paid but never settled.
   */
  private async recoverPaymentReceived(order: {
    id: string;
    amountUsd: Prisma.Decimal;
    paymentRef: string | null;
    product: { creatorId: string } | null;
  }): Promise<boolean> {
    // Find the creator's wallet
    const wallet = await this.prisma.wallet.findFirst({
      where: { creatorId: order.product?.creatorId ?? '' },
      select: { walletAddress: true },
    });

    const payload: PaymentReceivedPayload = {
      orderId: order.id,
      amountUsd: order.amountUsd.toFixed(2),
      creatorId: order.product?.creatorId ?? '',
      walletAddress: wallet?.walletAddress,
      paymentRef: order.paymentRef ?? `recovery-${order.id.slice(0, 8)}`,
    };

    this.emitter.emit(AppEvents.PaymentReceived, payload);
    return true;
  }

  /**
   * Verify settlement-pending orders by checking their txHash on-chain.
   */
  private async recoverSettlementPending(order: {
    id: string;
    txHash: string | null;
    amountUsd: { toFixed: (n: number) => string };
    product: { creatorId: string } | null;
  }): Promise<boolean> {
    if (!order.txHash) {
      // No txHash — settlement may have completed but the txHash was never
      // persisted (crash between Soroban confirmation and the DB update).
      // Check the contract's is_settled before marking as failed.
      try {
        const alreadySettled = await this.sorobanRpc.isSettled(order.id);
        if (alreadySettled) {
          this.logger.warn(
            `  🔁 Order ${order.id} has no txHash but is_settled() returned true — recovering Settlement row`,
          );
          await this.settlement.recordRecoveredSettlement(
            order.id,
            `unknown-${order.id.slice(0, 8)}`, // txHash unknown, generate a placeholder
          );
          return true;
        }
      } catch (checkErr) {
        this.logger.warn(
          `  ⚠️  is_settled check failed for order ${order.id} — proceeding to mark FAILED: ` +
            (checkErr instanceof Error ? checkErr.message : String(checkErr)),
        );
      }

      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.SETTLEMENT_FAILED },
      });
      this.logger.warn(`  ℹ️  Order ${order.id} has no txHash — marked SETTLEMENT_FAILED`);
      return false;
    }

    // txHash exists — try to verify on-chain.
    try {
      const status = await this.sorobanRpc.getTransactionStatus(order.txHash);
      if (status === 'SUCCESS') {
        // Check if Settlement row already exists (may have been created before crash).
        const existingSettlement = await this.prisma.settlement.findUnique({
          where: { orderId: order.id },
          select: { id: true },
        });
        if (existingSettlement) {
          await this.prisma.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.SETTLED },
          });
          return true;
        }

        // Settlement row missing — create it from what we know (amount, collaborators).
        await this.settlement.recordRecoveredSettlement(order.id, order.txHash);
        return true;
      }

      if (status === 'FAILED') {
        // Transaction failed — mark failed.
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.SETTLEMENT_FAILED },
        });
        return false;
      }

      // NOT_FOUND — tx may have been dropped from the mempool.
      // Give it one more check (the RPC may just be lagging), then retry.
      try {
        const retryStatus = await this.sorobanRpc.getTransactionStatus(order.txHash);
        if (retryStatus === 'SUCCESS') {
          this.logger.log(`  ✅ Tx ${order.txHash.slice(0, 16)}... confirmed on re-check — recovering`);
          await this.settlement.recordRecoveredSettlement(order.id, order.txHash);
          return true;
        }
        if (retryStatus === 'FAILED') {
          await this.prisma.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.SETTLEMENT_FAILED },
          });
          return false;
        }
      } catch {
        // RPC unavailable — leave for next startup.
      }

      // Still NOT_FOUND after re-check — tx was likely dropped. Clear the stale
      // txHash, roll back to PAYMENT_RECEIVED, and re-emit so settlement retries.
      this.logger.warn(
        `  🔁 Tx ${order.txHash.slice(0, 16)}... for order ${order.id} still NOT_FOUND — ` +
          'retrying settlement',
      );
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PAYMENT_RECEIVED, txHash: null },
      });
      this.emitter.emit(AppEvents.PaymentReceived, {
        orderId: order.id,
        amountUsd: order.amountUsd.toFixed(2),
        creatorId: order.product?.creatorId ?? '',
        walletAddress: undefined,
        paymentRef: `recovery-${order.id.slice(0, 8)}`,
      });
      return true;
    } catch {
      // Can't verify (RPC down, network error) — leave as SETTLEMENT_PENDING.
      // A future startup or manual intervention will retry.
      this.logger.warn(
        `  ℹ️  Cannot verify tx ${order.txHash.slice(0, 16)}... for order ${order.id} — leaving as SETTLEMENT_PENDING`,
      );
      return false;
    }
  }
}
