/**
 * Centralized event names — no magic strings scattered across emitters and
 * consumers. Add new events here only.
 *
 * Source: Kreav Backend PRD v3 — Section 10 (settlement sequence).
 */
export const AppEvents = {
  /**
   * Emitted by Orders (BE-005) when an order becomes PAID.
   * Consumed by Settlement Service (BE-007) to trigger the Stellar split.
   */
  PaymentReceived: 'payment.received',

  /**
   * Emitted by Checkout (BE-005) when payment is received but the creator has
   * no connected wallet. Settlement is deferred until the wallet is connected.
   * v3.1 §20 — WAITING_WALLET flow.
   */
  WalletConnectRequired: 'wallet.connect.required',

  /**
   * Emitted by Settlement (BE-007) after on-chain verification.
   * Consumed to finalize the Order to SETTLED.
   */
  SettlementCompleted: 'settlement.completed',
} as const;

export type AppEventName = (typeof AppEvents)[keyof typeof AppEvents];
