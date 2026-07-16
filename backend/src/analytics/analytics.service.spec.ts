import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: {
    order: { count: jest.Mock; aggregate: jest.Mock; findMany: jest.Mock };
    product: { count: jest.Mock };
    settlement: { findMany: jest.Mock; aggregate: jest.Mock };
    settlementRecipient: { aggregate: jest.Mock };
    $queryRawUnsafe: jest.Mock;
  };

  const CREATOR_ID = 'u1';

  beforeEach(async () => {
    prisma = {
      order: { count: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() },
      product: { count: jest.fn() },
      settlement: { findMany: jest.fn(), aggregate: jest.fn() },
      settlementRecipient: { aggregate: jest.fn() },
      $queryRawUnsafe: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [AnalyticsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(AnalyticsService);
  });

  describe('getAnalytics', () => {
    it('returns full KPI response with expected shape', async () => {
      prisma.order.aggregate
        .mockResolvedValueOnce({
          _sum: { amountUsd: new Prisma.Decimal('4218.00') },
          _count: { id: 42 },
        })
        .mockResolvedValueOnce({
          _sum: { amountUsd: new Prisma.Decimal('312.50') },
        });

      prisma.product.count.mockResolvedValue(5);

      prisma.order.findMany.mockResolvedValue([]);

      prisma.$queryRawUnsafe.mockResolvedValue([
        {
          product_id: 'p1',
          title: 'Sunset Presets',
          sales: BigInt(10),
          revenue: '180.00',
        },
        {
          product_id: 'p2',
          title: 'Night Presets',
          sales: BigInt(5),
          revenue: '90.00',
        },
      ]);

      const result = await service.getAnalytics(CREATOR_ID);

      expect(result.totals).toEqual({
        revenueUsd: '4218.00',
        sales: 42,
        activeProducts: 5,
        pendingPayout: '312.50',
      });

      expect(result.deltas).toEqual({
        revenue: 0,
        sales: 0,
        products: 0,
        payout: 0,
      });

      expect(result.revenueSeries).toHaveLength(30);
      for (const point of result.revenueSeries) {
        expect(point).toHaveProperty('day');
        expect(point).toHaveProperty('amount');
      }

      expect(result.topProducts).toEqual([
        { productId: 'p1', productTitle: 'Sunset Presets', sales: 10, revenue: '180.00' },
        { productId: 'p2', productTitle: 'Night Presets', sales: 5, revenue: '90.00' },
      ]);
    });

    it('counts only ACTIVE products in activeProducts', async () => {
      prisma.order.aggregate
        .mockResolvedValueOnce({
          _sum: { amountUsd: new Prisma.Decimal('100.00') },
          _count: { id: 0 },
        })
        .mockResolvedValueOnce({
          _sum: { amountUsd: new Prisma.Decimal('0.00') },
        });

      prisma.product.count.mockResolvedValue(3);
      prisma.order.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      await service.getAnalytics(CREATOR_ID);

      expect(prisma.product.count).toHaveBeenCalledWith({
        where: { creatorId: CREATOR_ID, status: 'ACTIVE' },
      });
      expect(prisma.product.count).toHaveBeenCalledTimes(1);
    });

    it('uses Decimal math for revenue values', async () => {
      prisma.order.aggregate
        .mockResolvedValueOnce({
          _sum: { amountUsd: new Prisma.Decimal('10.50') },
          _count: { id: 1 },
        })
        .mockResolvedValueOnce({
          _sum: { amountUsd: new Prisma.Decimal('0.00') },
        });

      prisma.product.count.mockResolvedValue(1);
      prisma.order.findMany.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.getAnalytics(CREATOR_ID);

      expect(result.totals.revenueUsd).toBe('10.50');
      expect(result.totals.pendingPayout).toBe('0.00');
    });
  });
});
