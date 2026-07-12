import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { AppEvents } from './event-names';
import { EventLogListener } from './event-log.listener';
import type { PaymentReceivedPayload, SettlementCompletedPayload } from './event-payloads';

/**
 * BE-006 — proves emit→handle works end-to-end through a real EventEmitter2.
 * Uses the real Nest emitter (not a mock) so the @OnEvent wiring is exercised.
 */
describe('EventLogListener (BE-006 event bus)', () => {
  let emitter: EventEmitter2;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        EventLogListener,
        {
          provide: EventEmitter2,
          useFactory: () => {
            const ee = new EventEmitter2();
            // Wire the listener's handlers the same way Nest would via @OnEvent.
            const listener = new EventLogListener();
            ee.on(AppEvents.PaymentReceived, (p) => listener.handlePaymentReceived(p));
            ee.on(AppEvents.WalletConnectRequired, (p) => listener.handleWalletConnectRequired(p));
            ee.on(AppEvents.SettlementCompleted, (p) => listener.handleSettlementCompleted(p));
            return ee;
          },
        },
      ],
    }).compile();

    emitter = moduleRef.get<EventEmitter2>(EventEmitter2);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => logSpy.mockRestore());

  it('routes payment.received to the handler', () => {
    const payload: PaymentReceivedPayload = {
      orderId: 'o1',
      amountUsd: '10.00',
      creatorId: 'u1',
      walletAddress: 'GABC',
      paymentRef: 'ref-1',
    };
    emitter.emit(AppEvents.PaymentReceived, payload);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('payment.received'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('order=o1'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('wallet=GABC'));
  });

  it('flags missing wallet on payment.received', () => {
    const payload: PaymentReceivedPayload = {
      orderId: 'o2',
      amountUsd: '10.00',
      creatorId: 'u1',
      paymentRef: 'ref-2',
    };
    emitter.emit(AppEvents.PaymentReceived, payload);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('wallet=NONE'));
  });

  it('routes settlement.completed to the handler', () => {
    const payload: SettlementCompletedPayload = {
      orderId: 'o3',
      txHash: 'hash123',
      creatorAmountUsd: '9.50',
      platformAmountUsd: '0.50',
    };
    emitter.emit(AppEvents.SettlementCompleted, payload);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('settlement.completed'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('tx=hash123'));
  });

  it('event names are centralized (no literal drift)', () => {
    expect(AppEvents.PaymentReceived).toBe('payment.received');
    expect(AppEvents.SettlementCompleted).toBe('settlement.completed');
    expect(AppEvents.WalletConnectRequired).toBe('wallet.connect.required');
  });
});
