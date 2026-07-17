import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SorobanRpcService } from '../../stellar/soroban-rpc.service';
import { SettlementService } from '../../stellar/settlement.service';
import { AppEvents } from '../../events/event-names';
import { StartupRecoveryService } from './startup-recovery.service';

type StuckOrder = {
  id: string;
  status: string;
  amountUsd: Prisma.Decimal;
  paymentRef: string | null;
  txHash: string | null;
  product: { creatorId: string; title: string } | null;
};

describe('StartupRecoveryService', () => {
  let service: StartupRecoveryService;
  let prisma: {
    order: { findMany: jest.Mock; update: jest.Mock };
    wallet: { findFirst: jest.Mock };
    settlement: { findUnique: jest.Mock };
  };
  let emitter: { emit: jest.Mock };
  let sorobanRpc: { getTransactionStatus: jest.Mock; isSettled: jest.Mock };
  let settlement: { recordRecoveredSettlement: jest.Mock };

  const baseOrder = (overrides: Partial<StuckOrder> = {}): StuckOrder => ({
    id: 'order-1',
    status: OrderStatus.PAYMENT_RECEIVED,
    amountUsd: new Prisma.Decimal('10.00'),
    paymentRef: 'gcash-tx-001',
    txHash: null,
    product: { creatorId: 'creator-1', title: 'My Product' },
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      order: { findMany: jest.fn(), update: jest.fn() },
      wallet: { findFirst: jest.fn() },
      settlement: { findUnique: jest.fn() },
    };
    emitter = { emit: jest.fn() };
    sorobanRpc = { getTransactionStatus: jest.fn(), isSettled: jest.fn() };
    settlement = { recordRecoveredSettlement: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        StartupRecoveryService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: emitter },
        { provide: SorobanRpcService, useValue: sorobanRpc },
        { provide: SettlementService, useValue: settlement },
      ],
    }).compile();

    service = moduleRef.get(StartupRecoveryService);
  });

  describe('onApplicationBootstrap', () => {
    it('does nothing when there are no stuck orders', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      await service.onApplicationBootstrap();

      expect(emitter.emit).not.toHaveBeenCalled();
      expect(settlement.recordRecoveredSettlement).not.toHaveBeenCalled();
    });

    it('re-emits payment.received for PAYMENT_RECEIVED orders', async () => {
      const order = baseOrder();
      prisma.order.findMany.mockResolvedValue([order]);
      prisma.wallet.findFirst.mockResolvedValue({ walletAddress: 'GABC123' });

      await service.onApplicationBootstrap();

      expect(emitter.emit).toHaveBeenCalledWith(
        AppEvents.PaymentReceived,
        expect.objectContaining({
          orderId: 'order-1',
          amountUsd: '10.00',
          creatorId: 'creator-1',
          walletAddress: 'GABC123',
          paymentRef: 'gcash-tx-001',
        }),
      );
    });

    it('recovers SETTLEMENT_PENDING with txHash when RPC returns SUCCESS and no Settlement row', async () => {
      const order = baseOrder({ status: OrderStatus.SETTLEMENT_PENDING, txHash: 'tx-abc' });
      prisma.order.findMany.mockResolvedValue([order]);
      sorobanRpc.getTransactionStatus.mockResolvedValue('SUCCESS');
      prisma.settlement.findUnique.mockResolvedValue(null);

      await service.onApplicationBootstrap();

      expect(settlement.recordRecoveredSettlement).toHaveBeenCalledWith('order-1', 'tx-abc');
    });

    it('marks SETTLED when RPC returns SUCCESS and Settlement row exists', async () => {
      const order = baseOrder({ status: OrderStatus.SETTLEMENT_PENDING, txHash: 'tx-abc' });
      prisma.order.findMany.mockResolvedValue([order]);
      sorobanRpc.getTransactionStatus.mockResolvedValue('SUCCESS');
      prisma.settlement.findUnique.mockResolvedValue({ id: 'settle-1' });

      await service.onApplicationBootstrap();

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: OrderStatus.SETTLED },
      });
      expect(settlement.recordRecoveredSettlement).not.toHaveBeenCalled();
    });

    it('marks SETTLEMENT_FAILED when RPC returns FAILED', async () => {
      const order = baseOrder({ status: OrderStatus.SETTLEMENT_PENDING, txHash: 'tx-abc' });
      prisma.order.findMany.mockResolvedValue([order]);
      sorobanRpc.getTransactionStatus.mockResolvedValue('FAILED');

      await service.onApplicationBootstrap();

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: OrderStatus.SETTLEMENT_FAILED },
      });
    });

    it('recovers no-txHash order when is_settled returns true', async () => {
      const order = baseOrder({ status: OrderStatus.SETTLEMENT_PENDING, txHash: null });
      prisma.order.findMany.mockResolvedValue([order]);
      sorobanRpc.isSettled.mockResolvedValue(true);

      await service.onApplicationBootstrap();

      expect(settlement.recordRecoveredSettlement).toHaveBeenCalledWith(
        'order-1',
        expect.stringContaining('unknown-order-1'),
      );
    });

    it('marks no-txHash order SETTLEMENT_FAILED when is_settled returns false', async () => {
      const order = baseOrder({ status: OrderStatus.SETTLEMENT_PENDING, txHash: null });
      prisma.order.findMany.mockResolvedValue([order]);
      sorobanRpc.isSettled.mockResolvedValue(false);

      await service.onApplicationBootstrap();

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: OrderStatus.SETTLEMENT_FAILED },
      });
    });

    it('recovers on NOT_FOUND → SUCCESS re-check', async () => {
      const order = baseOrder({ status: OrderStatus.SETTLEMENT_PENDING, txHash: 'tx-abc' });
      prisma.order.findMany.mockResolvedValue([order]);
      sorobanRpc.getTransactionStatus
        .mockResolvedValueOnce('NOT_FOUND')
        .mockResolvedValueOnce('SUCCESS');

      await service.onApplicationBootstrap();

      expect(settlement.recordRecoveredSettlement).toHaveBeenCalledWith('order-1', 'tx-abc');
    });

    it('marks FAILED on NOT_FOUND → FAILED re-check', async () => {
      const order = baseOrder({ status: OrderStatus.SETTLEMENT_PENDING, txHash: 'tx-abc' });
      prisma.order.findMany.mockResolvedValue([order]);
      sorobanRpc.getTransactionStatus
        .mockResolvedValueOnce('NOT_FOUND')
        .mockResolvedValueOnce('FAILED');

      await service.onApplicationBootstrap();

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: OrderStatus.SETTLEMENT_FAILED },
      });
    });

    it('rolls back to PAYMENT_RECEIVED + re-emits on NOT_FOUND → NOT_FOUND', async () => {
      const order = baseOrder({ status: OrderStatus.SETTLEMENT_PENDING, txHash: 'tx-abc' });
      prisma.order.findMany.mockResolvedValue([order]);
      sorobanRpc.getTransactionStatus
        .mockResolvedValueOnce('NOT_FOUND')
        .mockResolvedValueOnce('NOT_FOUND');

      await service.onApplicationBootstrap();

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: OrderStatus.PAYMENT_RECEIVED, txHash: null },
      });
      expect(emitter.emit).toHaveBeenCalledWith(
        AppEvents.PaymentReceived,
        expect.objectContaining({
          orderId: 'order-1',
          amountUsd: '10.00',
        }),
      );
    });

    it('continues processing remaining orders when one throws', async () => {
      const order1 = baseOrder({
        id: 'order-1',
        status: OrderStatus.SETTLEMENT_PENDING,
        txHash: 'tx-abc',
      });
      const order2 = baseOrder({
        id: 'order-2',
        status: OrderStatus.SETTLEMENT_PENDING,
        txHash: 'tx-def',
      });
      prisma.order.findMany.mockResolvedValue([order1, order2]);
      sorobanRpc.getTransactionStatus
        .mockRejectedValueOnce(new Error('RPC down'))
        .mockResolvedValueOnce('SUCCESS');
      prisma.settlement.findUnique.mockResolvedValue(null);

      await service.onApplicationBootstrap();

      // Second order should still be recovered despite first throwing
      expect(settlement.recordRecoveredSettlement).toHaveBeenCalledWith('order-2', 'tx-def');
    });

    it('returns false when RPC throws on verification (leaves as PENDING)', async () => {
      const order = baseOrder({ status: OrderStatus.SETTLEMENT_PENDING, txHash: 'tx-abc' });
      prisma.order.findMany.mockResolvedValue([order]);
      sorobanRpc.getTransactionStatus.mockRejectedValue(new Error('network error'));

      await service.onApplicationBootstrap();

      // No state change, no emit, no settlement call
      expect(prisma.order.update).not.toHaveBeenCalled();
      expect(emitter.emit).not.toHaveBeenCalled();
      expect(settlement.recordRecoveredSettlement).not.toHaveBeenCalled();
    });
  });
});
