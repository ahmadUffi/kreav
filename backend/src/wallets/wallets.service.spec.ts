import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HorizonService } from '../stellar/horizon.service';
import { ExplorerService } from '../stellar/explorer.service';
import { STELLAR_PUBLIC_CONFIG } from '../stellar/stellar.config';
import { AppEvents } from '../events/event-names';
import { WalletsService } from './wallets.service';

/**
 * WalletsService — test suite (BE-008 + BE-010).
 *
 * Tests assert:
 *   - getBalance delegates to HorizonService and returns correct shape
 *   - getTransactions queries SettlementRecipient table and paginates correctly
 *   - explorerLink is generated from the explorer URL + txHash (BE-010)
 *   - Empty states are handled gracefully
 *
 * HorizonService, PrismaService, and ExplorerService are fully mocked.
 */
describe('WalletsService', () => {
  let service: WalletsService;
  let horizon: { getUsdcBalance: jest.Mock };
  let prisma: {
    user: { findUnique: jest.Mock };
    settlementRecipient: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
    withdrawal: {
      findMany: jest.Mock;
    };
    wallet: {
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    order: {
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let emitter: { emit: jest.Mock };

  const MOCK_ADDRESS = 'GDA2SQ2PHWIER57TDXKLBSOD3IT4GTAHK5RV2H27LJZAXDBWQ6KYJ72B';
  const MOCK_EXPLORER_URL = 'https://stellar.expert/explorer/testnet';

  // Shared ExplorerService instance so the mock is consistent across tests.
  const mockExplorerService = {
    txUrl: (txHash: string) => `${MOCK_EXPLORER_URL}/tx/${txHash}`,
  };

  beforeEach(async () => {
    horizon = { getUsdcBalance: jest.fn() };
    prisma = {
      user: { findUnique: jest.fn() },
      settlementRecipient: { findMany: jest.fn(), count: jest.fn() },
      withdrawal: { findMany: jest.fn() },
      wallet: { findFirst: jest.fn(), create: jest.fn() },
      order: { findMany: jest.fn(), update: jest.fn() },
    };
    emitter = { emit: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: HorizonService, useValue: horizon },
        { provide: PrismaService, useValue: prisma },
        { provide: ExplorerService, useValue: mockExplorerService },
        { provide: EventEmitter2, useValue: emitter },
        {
          provide: STELLAR_PUBLIC_CONFIG,
          useValue: { explorerUrl: MOCK_EXPLORER_URL },
        },
      ],
    }).compile();

    service = moduleRef.get(WalletsService);
  });

  // ── getBalance ────────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('returns balance when account is funded and trustlined', async () => {
      horizon.getUsdcBalance.mockResolvedValue({
        balanceUsd: '9.50',
        hasUsdcTrustline: true,
        accountExists: true,
      });

      const result = await service.getBalance(MOCK_ADDRESS);

      expect(result).toEqual({
        address: MOCK_ADDRESS,
        balanceUsd: '9.50',
        hasUsdcTrustline: true,
        accountExists: true,
      });
      expect(horizon.getUsdcBalance).toHaveBeenCalledWith(MOCK_ADDRESS);
    });

    it('returns zero balance when account is not funded', async () => {
      horizon.getUsdcBalance.mockResolvedValue({
        balanceUsd: '0',
        hasUsdcTrustline: false,
        accountExists: false,
      });

      const result = await service.getBalance(MOCK_ADDRESS);

      expect(result).toEqual({
        address: MOCK_ADDRESS,
        balanceUsd: '0',
        hasUsdcTrustline: false,
        accountExists: false,
      });
    });

    it('returns zero balance when account has no USDC trustline', async () => {
      horizon.getUsdcBalance.mockResolvedValue({
        balanceUsd: '0',
        hasUsdcTrustline: false,
        accountExists: true,
      });

      const result = await service.getBalance(MOCK_ADDRESS);

      expect(result).toEqual({
        address: MOCK_ADDRESS,
        balanceUsd: '0',
        hasUsdcTrustline: false,
        accountExists: true,
      });
    });

    it('propagates Horizon errors', async () => {
      horizon.getUsdcBalance.mockRejectedValue(new Error('Horizon timeout'));

      await expect(service.getBalance(MOCK_ADDRESS)).rejects.toThrow('Horizon timeout');
    });
  });

  // ── getTransactions ───────────────────────────────────────────────────

  describe('getTransactions', () => {
    it('returns paginated transactions with explorerLink for a wallet address', async () => {
      const mockRows = [
        {
          id: 'rec-1',
          settlementId: 'settle-1',
          walletAddress: MOCK_ADDRESS,
          recipientType: 'CREATOR',
          role: 'Author',
          percentage: { toFixed: () => '95.00' },
          amount: { toFixed: () => '9.50' },
          createdAt: new Date('2026-06-29T12:00:00Z'),
          settlement: {
            orderId: 'order-1',
            txHash: 'abc123',
            totalAmount: { toFixed: () => '10.00' },
            status: 'COMPLETED',
            createdAt: new Date('2026-06-29T12:00:00Z'),
          },
        },
        {
          id: 'rec-2',
          settlementId: 'settle-2',
          walletAddress: MOCK_ADDRESS,
          recipientType: 'PLATFORM',
          role: 'Platform Fee',
          percentage: { toFixed: () => '5.00' },
          amount: { toFixed: () => '0.50' },
          createdAt: new Date('2026-06-29T11:00:00Z'),
          settlement: {
            orderId: 'order-2',
            txHash: 'def456',
            totalAmount: { toFixed: () => '10.00' },
            status: 'COMPLETED',
            createdAt: new Date('2026-06-29T11:00:00Z'),
          },
        },
      ];

      prisma.settlementRecipient.findMany.mockResolvedValue(mockRows);
      prisma.settlementRecipient.count.mockResolvedValue(2);

      const result = await service.getTransactions(MOCK_ADDRESS, 1, 20);

      expect(result).toEqual({
        address: MOCK_ADDRESS,
        transactions: [
          {
            id: 'rec-1',
            kind: 'SETTLEMENT',
            orderId: 'order-1',
            txHash: 'abc123',
            explorerLink: `${MOCK_EXPLORER_URL}/tx/abc123`,
            totalAmount: '10.00',
            amount: '9.50',
            recipientType: 'CREATOR',
            role: 'Author',
            percentage: '95.00',
            direction: 'credit',
            destination: '',
            status: 'COMPLETED',
            createdAt: '2026-06-29T12:00:00.000Z',
          },
          {
            id: 'rec-2',
            kind: 'SETTLEMENT',
            orderId: 'order-2',
            txHash: 'def456',
            explorerLink: `${MOCK_EXPLORER_URL}/tx/def456`,
            totalAmount: '10.00',
            amount: '0.50',
            recipientType: 'PLATFORM',
            role: 'Platform Fee',
            percentage: '5.00',
            direction: 'debit',
            destination: '',
            status: 'COMPLETED',
            createdAt: '2026-06-29T11:00:00.000Z',
          },
        ],
        page: 1,
        limit: 20,
        total: 2,
      });
    });

    it('generates explorerLink using the txHash', async () => {
      const mockRows = [
        {
          id: 'rec-1',
          settlementId: 'settle-1',
          walletAddress: MOCK_ADDRESS,
          recipientType: 'CREATOR',
          role: 'Author',
          percentage: { toFixed: () => '100.00' },
          amount: { toFixed: () => '10.00' },
          createdAt: new Date('2026-06-29T12:00:00Z'),
          settlement: {
            orderId: 'order-1',
            txHash: 'a1b2c3d4e5f6',
            totalAmount: { toFixed: () => '10.00' },
            status: 'COMPLETED',
            createdAt: new Date('2026-06-29T12:00:00Z'),
          },
        },
      ];

      prisma.settlementRecipient.findMany.mockResolvedValue(mockRows);
      prisma.settlementRecipient.count.mockResolvedValue(1);

      const result = await service.getTransactions(MOCK_ADDRESS, 1, 20);

      expect(result.transactions[0].explorerLink).toBe(`${MOCK_EXPLORER_URL}/tx/a1b2c3d4e5f6`);
    });

    it('returns empty list when address has no transactions', async () => {
      prisma.settlementRecipient.findMany.mockResolvedValue([]);
      prisma.settlementRecipient.count.mockResolvedValue(0);

      const result = await service.getTransactions(MOCK_ADDRESS, 1, 20);

      expect(result).toEqual({
        address: MOCK_ADDRESS,
        transactions: [],
        page: 1,
        limit: 20,
        total: 0,
      });
    });

    it('respects pagination parameters', async () => {
      const rows = [
        {
          id: 'rec-1',
          settlementId: 'settle-1',
          walletAddress: MOCK_ADDRESS,
          recipientType: 'CREATOR',
          role: 'Author',
          percentage: { toFixed: () => '100.00' },
          amount: { toFixed: () => '10.00' },
          createdAt: new Date('2026-06-29T12:00:00Z'),
          settlement: {
            orderId: 'order-1',
            txHash: 'abc123',
            totalAmount: { toFixed: () => '10.00' },
            status: 'COMPLETED',
            createdAt: new Date('2026-06-29T12:00:00Z'),
          },
        },
      ];
      prisma.settlementRecipient.findMany.mockResolvedValue(rows);
      prisma.settlementRecipient.count.mockResolvedValue(1);

      const result = await service.getTransactions(MOCK_ADDRESS, 3, 10);

      expect(result).toEqual({
        address: MOCK_ADDRESS,
        transactions: [],
        page: 3,
        limit: 10,
        total: 1,
      });
    });
  });

  // ── connect (BE-020 + C1/C3 fixes) ────────────────────────────────────

  describe('connect', () => {
    const creatorId = 'u1';
    const walletAddress = 'GCREATOR1';

    const mockWalletRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
      id: 'w1',
      creatorId,
      walletAddress,
      provider: 'FREIGHTER',
      connectedAt: new Date('2026-07-01T12:00:00Z'),
      ...overrides,
    });

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ id: creatorId });
      prisma.wallet.findFirst.mockResolvedValue(null); // no existing wallet
      prisma.wallet.create.mockResolvedValue(mockWalletRow());
      prisma.order.findMany.mockResolvedValue([]); // no WAITING_WALLET orders
    });

    it('creates a wallet and returns the expected fields', async () => {
      const result = await service.connect(creatorId, walletAddress, 'FREIGHTER');

      expect(result.id).toBe('w1');
      expect(result.creatorId).toBe(creatorId);
      expect(result.walletAddress).toBe(walletAddress);
      expect(result.provider).toBe('FREIGHTER');
      expect(result.connectedAt).toBe('2026-07-01T12:00:00.000Z');
    });

    it('throws NotFoundException when creator does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.connect(creatorId, walletAddress, 'FREIGHTER')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ConflictException when wallet is already connected (findFirst)', async () => {
      prisma.wallet.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.connect(creatorId, walletAddress, 'FREIGHTER')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws ConflictException on P2002 unique violation (TOCTOU guard)', async () => {
      prisma.wallet.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.connect(creatorId, walletAddress, 'FREIGHTER')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('re-throws non-P2002 errors from create', async () => {
      const dbErr = new Error('connection refused');
      prisma.wallet.create.mockRejectedValue(dbErr);

      await expect(service.connect(creatorId, walletAddress, 'FREIGHTER')).rejects.toThrow(
        'connection refused',
      );
    });

    it('resumes WAITING_WALLET orders by emitting payment.received', async () => {
      const waitingOrders = [
        {
          id: 'order-1',
          amountUsd: new Prisma.Decimal('10.00'),
          paymentRef: 'gcash-tx-001',
          product: { creatorId },
        },
        {
          id: 'order-2',
          amountUsd: new Prisma.Decimal('5.00'),
          paymentRef: 'gcash-tx-002',
          product: { creatorId },
        },
      ];
      prisma.order.findMany.mockResolvedValue(waitingOrders);

      await service.connect(creatorId, walletAddress, 'FREIGHTER');

      expect(emitter.emit).toHaveBeenCalledTimes(2);
      expect(emitter.emit).toHaveBeenCalledWith(
        AppEvents.PaymentReceived,
        expect.objectContaining({
          orderId: 'order-1',
          amountUsd: '10.00',
          walletAddress,
        }),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        AppEvents.PaymentReceived,
        expect.objectContaining({
          orderId: 'order-2',
          amountUsd: '5.00',
          walletAddress,
        }),
      );
    });

    it('emits payment.received with fallback paymentRef when null', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'order-1',
          amountUsd: new Prisma.Decimal('10.00'),
          paymentRef: null,
          product: { creatorId },
        },
      ]);

      await service.connect(creatorId, walletAddress, 'FREIGHTER');

      expect(emitter.emit).toHaveBeenCalledWith(
        AppEvents.PaymentReceived,
        expect.objectContaining({
          paymentRef: 'resume-order-1',
        }),
      );
    });

    it('does not emit when there are no WAITING_WALLET orders', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      await service.connect(creatorId, walletAddress, 'FREIGHTER');

      expect(emitter.emit).not.toHaveBeenCalled();
    });
  });
});
