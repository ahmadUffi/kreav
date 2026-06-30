import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HorizonService } from '../stellar/horizon.service';
import { WalletsService } from './wallets.service';

/**
 * WalletsService — test suite (BE-008).
 *
 * Tests assert:
 *   - getBalance delegates to HorizonService and returns correct shape
 *   - getTransactions queries SettlementRecipient table and paginates correctly
 *   - Empty states are handled gracefully
 *
 * HorizonService and PrismaService are fully mocked — no Stellar network calls.
 */
describe('WalletsService', () => {
  let service: WalletsService;
  let horizon: { getUsdcBalance: jest.Mock };
  let prisma: {
    settlementRecipient: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };

  const MOCK_ADDRESS = 'GDA2SQ2PHWIER57TDXKLBSOD3IT4GTAHK5RV2H27LJZAXDBWQ6KYJ72B';

  beforeEach(async () => {
    horizon = { getUsdcBalance: jest.fn() };
    prisma = {
      settlementRecipient: { findMany: jest.fn(), count: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: HorizonService, useValue: horizon },
        { provide: PrismaService, useValue: prisma },
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
    it('returns paginated transactions for a wallet address', async () => {
      const mockRows = [
        {
          id: 'rec-1',
          settlementId: 'settle-1',
          walletAddress: MOCK_ADDRESS,
          recipientType: 'CREATOR',
          role: 'Author',
          percentage: { toString: () => '95.00' },
          amount: { toString: () => '9.50' },
          createdAt: new Date('2026-06-29T12:00:00Z'),
          settlement: {
            orderId: 'order-1',
            txHash: 'abc123',
            totalAmount: { toString: () => '10.00' },
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
          percentage: { toString: () => '5.00' },
          amount: { toString: () => '0.50' },
          createdAt: new Date('2026-06-29T11:00:00Z'),
          settlement: {
            orderId: 'order-2',
            txHash: 'def456',
            totalAmount: { toString: () => '10.00' },
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
            orderId: 'order-1',
            txHash: 'abc123',
            totalAmount: '10.00',
            amount: '9.50',
            recipientType: 'CREATOR',
            role: 'Author',
            percentage: '95.00',
            status: 'COMPLETED',
            createdAt: '2026-06-29T12:00:00.000Z',
          },
          {
            id: 'rec-2',
            orderId: 'order-2',
            txHash: 'def456',
            totalAmount: '10.00',
            amount: '0.50',
            recipientType: 'PLATFORM',
            role: 'Platform Fee',
            percentage: '5.00',
            status: 'COMPLETED',
            createdAt: '2026-06-29T11:00:00.000Z',
          },
        ],
        page: 1,
        limit: 20,
        total: 2,
      });

      expect(prisma.settlementRecipient.findMany).toHaveBeenCalledWith({
        where: { walletAddress: MOCK_ADDRESS },
        include: {
          settlement: {
            select: {
              orderId: true,
              txHash: true,
              totalAmount: true,
              status: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
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
      prisma.settlementRecipient.findMany.mockResolvedValue([]);
      prisma.settlementRecipient.count.mockResolvedValue(0);

      await service.getTransactions(MOCK_ADDRESS, 3, 10);

      expect(prisma.settlementRecipient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3-1) * 10
          take: 10,
        }),
      );
    });
  });
});
