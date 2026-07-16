import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HorizonService } from '../stellar/horizon.service';
import { ExplorerService } from '../stellar/explorer.service';
import { STELLAR_CONFIG } from '../stellar/stellar.config';
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
    settlementRecipient: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
    withdrawal: {
      findMany: jest.Mock;
    };
    wallet: {
      findFirst: jest.Mock;
    };
  };

  const MOCK_ADDRESS = 'GDA2SQ2PHWIER57TDXKLBSOD3IT4GTAHK5RV2H27LJZAXDBWQ6KYJ72B';
  const MOCK_EXPLORER_URL = 'https://stellar.expert/explorer/testnet';

  // Shared ExplorerService instance so the mock is consistent across tests.
  const mockExplorerService = {
    txUrl: (txHash: string) => `${MOCK_EXPLORER_URL}/tx/${txHash}`,
  };

  beforeEach(async () => {
    horizon = { getUsdcBalance: jest.fn() };
    prisma = {
      settlementRecipient: { findMany: jest.fn(), count: jest.fn() },
      withdrawal: { findMany: jest.fn() },
      wallet: { findFirst: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: HorizonService, useValue: horizon },
        { provide: PrismaService, useValue: prisma },
        { provide: ExplorerService, useValue: mockExplorerService },
        {
          provide: STELLAR_CONFIG,
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
});
