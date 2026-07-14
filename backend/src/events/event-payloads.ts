/**
 * Typed event payload contracts — emitters and consumers share these so the
 * compiler catches shape drift between BE-005 (emitter) and BE-007 (consumer).
 *
 * Money is always a decimal string here ("10.00"), matching the
 * DecimalToStringInterceptor convention and the Settlement contract input.
 *
 * Source: Kreav Backend PRD v3 — Section 10.
 */

/** `payment.received` — emitted when an order transitions to PAYMENT_RECEIVED. */
export interface PaymentReceivedPayload {
  orderId: string;
  amountUsd: string; // decimal string, e.g. "10.00"
  creatorId: string;
  /** Creator's connected wallet, if any. Absent → WAITING_WALLET. */
  walletAddress?: string;
  /** Payment Transaction ID — the idempotency key (v3.1 §20). */
  paymentRef: string;
}

/**
 * `wallet.connect.required` — emitted when payment is received but the creator
 * has no connected wallet. Settlement is deferred (v3.1 §20).
 */
export interface WalletConnectRequiredPayload {
  orderId: string;
  creatorId: string;
  amountUsd: string;
  paymentRef: string;
}

/** `settlement.completed` — emitted after on-chain verification (BE-007). */
export interface SettlementCompletedPayload {
  orderId: string;
  txHash: string;
  creatorAmountUsd: string;
  platformAmountUsd: string;
}
