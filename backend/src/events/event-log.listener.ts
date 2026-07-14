import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppEvents } from './event-names';
import type {
  PaymentReceivedPayload,
  WalletConnectRequiredPayload,
  SettlementCompletedPayload,
} from './event-payloads';

/**
 * Logs every domain event with a structured line — gives a visible trail in
 * the console during the demo (you can watch "payment.received" fire).
 *
 * Source: Kreav Backend PRD v3 — Section 10, BE-006 §3 (logging hook).
 */
export class EventLogListener {
  private readonly logger = new Logger('EventBus');

  @OnEvent(AppEvents.PaymentReceived)
  handlePaymentReceived(payload: PaymentReceivedPayload) {
    this.logger.log(
      `payment.received → order=${payload.orderId} amount=${payload.amountUsd} ` +
        `creator=${payload.creatorId} wallet=${payload.walletAddress ?? 'NONE'} ref=${payload.paymentRef}`,
    );
  }

  @OnEvent(AppEvents.WalletConnectRequired)
  handleWalletConnectRequired(payload: WalletConnectRequiredPayload) {
    this.logger.log(
      `wallet.connect.required → order=${payload.orderId} creator=${payload.creatorId} ` +
        `amount=${payload.amountUsd} ref=${payload.paymentRef}`,
    );
  }

  @OnEvent(AppEvents.SettlementCompleted)
  handleSettlementCompleted(payload: SettlementCompletedPayload) {
    this.logger.log(
      `settlement.completed → order=${payload.orderId} tx=${payload.txHash} ` +
        `creator=${payload.creatorAmountUsd} platform=${payload.platformAmountUsd}`,
    );
  }
}
