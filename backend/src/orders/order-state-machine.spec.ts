import { OrderStatus } from '@prisma/client';
import { canTransition, isTerminal } from './order-state-machine';

/**
 * v3.1 §20 — exhaustive unit tests for the Order state machine.
 * Pure logic (no Prisma, no Nest) so every legal/illegal transition is checked.
 */
describe('OrderStateMachine (v3.1 §20)', () => {
  describe('happy-path lifecycle', () => {
    it.each([
      ['CREATED', OrderStatus.CREATED, OrderStatus.CHECKOUT_STARTED],
      ['CHECKOUT_STARTED', OrderStatus.CHECKOUT_STARTED, OrderStatus.PAYMENT_PENDING],
      ['PAYMENT_PENDING', OrderStatus.PAYMENT_PENDING, OrderStatus.PAYMENT_RECEIVED],
      ['PAYMENT_RECEIVED', OrderStatus.PAYMENT_RECEIVED, OrderStatus.SETTLEMENT_PENDING],
      ['SETTLEMENT_PENDING', OrderStatus.SETTLEMENT_PENDING, OrderStatus.SETTLED],
      ['SETTLED', OrderStatus.SETTLED, OrderStatus.WITHDRAW_PENDING],
      ['WITHDRAW_PENDING', OrderStatus.WITHDRAW_PENDING, OrderStatus.WITHDRAW_COMPLETED],
    ])('allows %s → next', (_label, from, to) => {
      expect(canTransition(from, to)).toBe(true);
    });
  });

  describe('failure / deferral branches', () => {
    it('allows PAYMENT_PENDING → PAYMENT_FAILED', () => {
      expect(canTransition(OrderStatus.PAYMENT_PENDING, OrderStatus.PAYMENT_FAILED)).toBe(true);
    });

    it('allows PAYMENT_RECEIVED → WAITING_WALLET (no wallet, defer)', () => {
      expect(canTransition(OrderStatus.PAYMENT_RECEIVED, OrderStatus.WAITING_WALLET)).toBe(true);
    });

    it('allows WAITING_WALLET → SETTLEMENT_PENDING (wallet connected, resume)', () => {
      expect(canTransition(OrderStatus.WAITING_WALLET, OrderStatus.SETTLEMENT_PENDING)).toBe(true);
    });

    it('allows SETTLEMENT_PENDING → SETTLEMENT_FAILED', () => {
      expect(canTransition(OrderStatus.SETTLEMENT_PENDING, OrderStatus.SETTLEMENT_FAILED)).toBe(
        true,
      );
    });

    it('allows WITHDRAW_PENDING → WITHDRAW_FAILED', () => {
      expect(canTransition(OrderStatus.WITHDRAW_PENDING, OrderStatus.WITHDRAW_FAILED)).toBe(true);
    });
  });

  describe('invalid transitions are rejected', () => {
    it('rejects skipping stages: CREATED → PAYMENT_RECEIVED', () => {
      expect(canTransition(OrderStatus.CREATED, OrderStatus.PAYMENT_RECEIVED)).toBe(false);
    });

    it('rejects jumping to settlement: CHECKOUT_STARTED → SETTLED', () => {
      expect(canTransition(OrderStatus.CHECKOUT_STARTED, OrderStatus.SETTLED)).toBe(false);
    });

    it('rejects going backwards: SETTLED → PAYMENT_RECEIVED', () => {
      expect(canTransition(OrderStatus.SETTLED, OrderStatus.PAYMENT_RECEIVED)).toBe(false);
    });

    it('rejects terminal → anything: WITHDRAW_COMPLETED → SETTLED', () => {
      expect(canTransition(OrderStatus.WITHDRAW_COMPLETED, OrderStatus.SETTLED)).toBe(false);
    });
  });

  describe('terminal states', () => {
    it.each([
      [OrderStatus.WITHDRAW_COMPLETED],
      [OrderStatus.PAYMENT_FAILED],
      [OrderStatus.SETTLEMENT_FAILED],
      [OrderStatus.WITHDRAW_FAILED],
      [OrderStatus.CANCELLED],
    ])('marks %s as terminal', (status) => {
      expect(isTerminal(status)).toBe(true);
    });

    it('marks non-final states as non-terminal', () => {
      expect(isTerminal(OrderStatus.PAYMENT_RECEIVED)).toBe(false);
      expect(isTerminal(OrderStatus.SETTLEMENT_PENDING)).toBe(false);
    });
  });
});
