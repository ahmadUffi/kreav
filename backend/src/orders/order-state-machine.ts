import { OrderStatus } from '@prisma/client';

/**
 * v3.1 §20 — Order state machine.
 *
 * Defines the ONLY legal transitions an Order may make. Any transition not in
 * this map is rejected with `INVALID_STATE_TRANSITION` (400). Keeping this as a
 * pure, Prisma-free module means the rules are exhaustively unit-testable
 * without a database.
 *
 * Lifecycle:
 *   CREATED → CHECKOUT_STARTED → PAYMENT_PENDING → PAYMENT_RECEIVED
 *          → SETTLEMENT_PENDING → SETTLED → WITHDRAW_PENDING → WITHDRAW_COMPLETED
 *
 * Failure / deferral branches:
 *   PAYMENT_PENDING     → PAYMENT_FAILED
 *   PAYMENT_RECEIVED    → WAITING_WALLET  (creator has no wallet; settlement deferred)
 *   WAITING_WALLET      → SETTLEMENT_PENDING  (wallet connected; resume)
 *   SETTLEMENT_PENDING  → SETTLEMENT_FAILED
 *   WITHDRAW_PENDING    → WITHDRAW_FAILED
 *   any non-terminal     → CANCELLED
 */
const TRANSITIONS: Readonly<Record<OrderStatus, ReadonlyArray<OrderStatus>>> = {
  [OrderStatus.CREATED]: [OrderStatus.CHECKOUT_STARTED, OrderStatus.CANCELLED],
  [OrderStatus.CHECKOUT_STARTED]: [OrderStatus.PAYMENT_PENDING, OrderStatus.CANCELLED],
  [OrderStatus.PAYMENT_PENDING]: [
    OrderStatus.PAYMENT_RECEIVED,
    OrderStatus.PAYMENT_FAILED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAYMENT_RECEIVED]: [
    OrderStatus.SETTLEMENT_PENDING,
    OrderStatus.WAITING_WALLET,
    OrderStatus.CANCELLED,
  ],
  // Settlement deferred until the creator connects a wallet.
  [OrderStatus.WAITING_WALLET]: [OrderStatus.SETTLEMENT_PENDING, OrderStatus.CANCELLED],
  [OrderStatus.SETTLEMENT_PENDING]: [
    OrderStatus.SETTLED,
    OrderStatus.SETTLEMENT_FAILED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.SETTLED]: [OrderStatus.WITHDRAW_PENDING],
  [OrderStatus.WITHDRAW_PENDING]: [
    OrderStatus.WITHDRAW_COMPLETED,
    OrderStatus.WITHDRAW_FAILED,
    OrderStatus.CANCELLED,
  ],
  // Terminal states — no outgoing transitions.
  [OrderStatus.WITHDRAW_COMPLETED]: [],
  [OrderStatus.PAYMENT_FAILED]: [],
  [OrderStatus.SETTLEMENT_FAILED]: [],
  [OrderStatus.WITHDRAW_FAILED]: [],
  [OrderStatus.CANCELLED]: [],
};

/**
 * Returns true iff `from → to` is a permitted transition.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** States that cannot transition anywhere (the order is finished). */
export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
