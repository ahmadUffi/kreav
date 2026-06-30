import { Test } from '@nestjs/testing';
import { Prisma, WithdrawalStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExplorerService } from '../stellar/explorer.service';
import { STELLAR_CONFIG } from '../stellar/stellar.config';
import { WithdrawalsService } from './withdrawals.service';

describe('WithdrawalsService', () => {
  let service: WithdrawalsService;
  let prisma: {
    wallet: { findFirst: jest.Mock };
    settlementRecipient: { aggregate: jest.Mock; findFirst: jest.Mock };
    withdrawal: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      aggregate: jest.Mock;
    };
  };

  const MOCK_ADDRESS = 'GDA2SQ2PHWIER57TDXKLBSOD3IT4GTAHK5RV2H27LJZAXDBWQ6KYJ72B';
  const MOCK_CREATOR_ID = 'creator-uuid-123';
  const MOCK_AMOUNT = 5.0;

  const mockExplorerService = {
    txUrl: (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`,
  };

  beforeEach(async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
    prisma = {
      wallet: { findFirst: jest.fn() },
      settlementRecipient: { aggregate: jest.fn(), findFirst: jest.fn() },
      withdrawal: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WithdrawalsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ExplorerService, useValue: mockExplorerService },
        {
          provide: STELLAR_CONFIG,
          useValue: { explorerUrl: 'https://stellar.expert/explorer/testnet' },
        },
      ],
    }).compile();

    service = moduleRef.get(WithdrawalsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── getWithdrawableBalance ──────────────────────────────────────────────

  describe('getWithdrawableBalance', () => {
    it('returns zero when wallet is not found', async () => {
      prisma.wallet.findFirst.mockResolvedValue(null);

      const result = await service.getWithdrawableBalance(MOCK_ADDRESS);
      expect(result.toNumber()).toBe(0);
    });

    it('returns settled minus withdrawn', async () => {
      prisma.wallet.findFirst.mockResolvedValue({ creatorId: MOCK_CREATOR_ID });
      prisma.settlementRecipient.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(100) },
      });
      prisma.withdrawal.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(30) },
      });

      const result = await service.getWithdrawableBalance(MOCK_ADDRESS);
      expect(result.toNumber()).toBe(70); // 100 - 30
    });
  });

  // ── requestWithdrawal ───────────────────────────────────────────────────

  describe('requestWithdrawal', () => {
    it('returns a receipt with PROCESSING status on success', async () => {
      prisma.wallet.findFirst.mockResolvedValue({ creatorId: MOCK_CREATOR_ID });
      prisma.settlementRecipient.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(100) },
      });
      prisma.withdrawal.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(30) },
      });
      prisma.withdrawal.findFirst.mockResolvedValue(null);
      prisma.settlementRecipient.findFirst.mockResolvedValue({
        settlement: { txHash: 'abc123' },
      });
      prisma.withdrawal.create.mockResolvedValue({
        id: 'wd-uuid',
        reference: 'KRV-WD-20260630-000001',
        amount: new Prisma.Decimal(MOCK_AMOUNT),
        createdAt: new Date(),
      });

      const receipt = await service.requestWithdrawal(
        MOCK_ADDRESS,
        MOCK_AMOUNT,
        'GCASH',
        '0917xxxxxxx',
      );

      expect(receipt.status).toBe('PROCESSING');
      expect(receipt.amount).toBe(MOCK_AMOUNT);
      expect(receipt.reference).toContain('KRV-WD');
      expect(receipt.withdrawalId).toBe('wd-uuid');
      const r = receipt as any;
      expect(r.receiptVersion).toBe('1.0');
      expect(r.simulation).toBeDefined();
      expect(r.simulation.mode).toBe('SIMULATED');
      expect(r.simulation.realComponents).toContain('Settlement');
      expect(r.simulation.simulatedComponents).toContain('Anchor');
      expect(r.settlementTxHash).toBe('abc123');
      expect(r.settlementExplorerUrl).toContain('stellar.expert');
    });

    it('throws INSUFFICIENT_BALANCE when balance is too low', async () => {
      prisma.wallet.findFirst.mockResolvedValue({ creatorId: MOCK_CREATOR_ID });
      prisma.settlementRecipient.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(10) },
      });
      prisma.withdrawal.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(9) },
      });

      await expect(
        service.requestWithdrawal(MOCK_ADDRESS, 5.0, 'GCASH', '0917xxxxxxx'),
      ).rejects.toThrow(/Insufficient/);
    });

    it('throws WALLET_NOT_FOUND when address has no wallet', async () => {
      prisma.wallet.findFirst.mockResolvedValue(null);

      await expect(
        service.requestWithdrawal(MOCK_ADDRESS, 5.0, 'GCASH', '0917xxxxxxx'),
      ).rejects.toThrow(/No wallet found/);
    });
  });

  // ── getWithdrawal ───────────────────────────────────────────────────────

  describe('getWithdrawal', () => {
    it('returns a receipt for an existing withdrawal', async () => {
      prisma.withdrawal.findUnique.mockResolvedValue({
        id: 'wd-uuid',
        reference: 'KRV-WD-000001',
        status: WithdrawalStatus.COMPLETED,
        amount: new Prisma.Decimal(5.0),
        destinationType: 'GCASH',
        destinationAccount: '0917xxxxxxx',
        settlementTxHash: 'abc123',
        creatorId: MOCK_CREATOR_ID,
        createdAt: new Date(),
        completedAt: new Date(),
      });
      prisma.wallet.findFirst.mockResolvedValue({ walletAddress: MOCK_ADDRESS });
      prisma.settlementRecipient.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(100) },
      });
      prisma.withdrawal.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(5) },
      });

      const receipt = await service.getWithdrawal('wd-uuid');

      const r = receipt as any;
      expect(r.status).toBe('COMPLETED');
      expect(r.withdrawalId).toBe('wd-uuid');
      expect(r.simulation).toBeDefined();
    });

    it('throws NotFoundException for unknown withdrawal', async () => {
      prisma.withdrawal.findUnique.mockResolvedValue(null);

      await expect(service.getWithdrawal('unknown-id')).rejects.toThrow('Withdrawal not found');
    });

    it('lazy-transitions PROCESSING to COMPLETED after delay', async () => {
      const createdAt = new Date(Date.now() - 3000); // 3 seconds ago (> 2.5s delay)
      prisma.withdrawal.findUnique.mockResolvedValue({
        id: 'wd-uuid',
        reference: 'KRV-WD-000001',
        status: WithdrawalStatus.PROCESSING,
        amount: new Prisma.Decimal(5.0),
        destinationType: 'GCASH',
        destinationAccount: '0917xxxxxxx',
        settlementTxHash: 'abc123',
        creatorId: MOCK_CREATOR_ID,
        createdAt,
        completedAt: null,
      });
      prisma.wallet.findFirst.mockResolvedValue({ walletAddress: MOCK_ADDRESS });
      prisma.settlementRecipient.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(100) },
      });
      prisma.withdrawal.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(0) },
      });
      prisma.withdrawal.update.mockResolvedValue({});

      const receipt = await service.getWithdrawal('wd-uuid');

      expect(receipt.status).toBe('COMPLETED');
      expect(prisma.withdrawal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'wd-uuid' },
          data: expect.objectContaining({ status: WithdrawalStatus.COMPLETED }),
        }),
      );
    });

    it('keeps PROCESSING status when delay has not elapsed', async () => {
      const createdAt = new Date(); // Created just now
      prisma.withdrawal.findUnique.mockResolvedValue({
        id: 'wd-uuid',
        reference: 'KRV-WD-000001',
        status: WithdrawalStatus.PROCESSING,
        amount: new Prisma.Decimal(5.0),
        destinationType: 'GCASH',
        destinationAccount: '0917xxxxxxx',
        settlementTxHash: 'abc123',
        creatorId: MOCK_CREATOR_ID,
        createdAt,
        completedAt: null,
      });
      prisma.wallet.findFirst.mockResolvedValue({ walletAddress: MOCK_ADDRESS });
      prisma.settlementRecipient.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(100) },
      });
      prisma.withdrawal.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(0) },
      });

      const receipt = await service.getWithdrawal('wd-uuid');

      expect(receipt.status).toBe('PROCESSING');
      expect(prisma.withdrawal.update).not.toHaveBeenCalled();
    });
  });

  // ── listWithdrawals ────────────────────────────────────────────────────

  describe('listWithdrawals', () => {
    it('returns paginated withdrawals', async () => {
      prisma.wallet.findFirst.mockResolvedValue({ creatorId: MOCK_CREATOR_ID });
      prisma.withdrawal.findMany.mockResolvedValue([
        {
          id: 'wd-1',
          reference: 'KRV-WD-000001',
          status: WithdrawalStatus.COMPLETED,
          amount: new Prisma.Decimal(5.0),
          destinationType: 'GCASH',
          destinationAccount: '0917xxxxxxx',
          settlementTxHash: null,
          createdAt: new Date(),
          completedAt: new Date(),
        },
      ]);
      prisma.withdrawal.count.mockResolvedValue(1);

      const result = await service.listWithdrawals(MOCK_ADDRESS, 1, 20);

      expect(result.address).toBe(MOCK_ADDRESS);
      expect(result.withdrawals).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.withdrawals[0].reference).toBe('KRV-WD-000001');
    });

    it('returns empty list for address with no wallet', async () => {
      prisma.wallet.findFirst.mockResolvedValue(null);

      const result = await service.listWithdrawals(MOCK_ADDRESS, 1, 20);

      expect(result.withdrawals).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});
