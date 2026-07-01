import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsResponseDto } from './dto';

/**
 * AnalyticsService — BE-019 aggregation logic.
 *
 * Computes dashboard KPIs from Order + Settlement + Product tables.
 * All monetary values are strings (DecimalToStringInterceptor convention).
 *
 * Deltas return 0 for MVP (period-over-period comparison is complex and
 * not meaningful with the limited testnet data available).
 *
 * Source: BE-019 — Dashboard Analytics API.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /analytics — compute all dashboard KPIs for a creator.
   */
  async getAnalytics(creatorId: string): Promise<AnalyticsResponseDto> {
    const [
      settledStats,
      pendingStats,
      activeProducts,
      topProductsRaw,
      revenueDays,
    ] = await Promise.all([
      this.getSettledStats(creatorId),
      this.getPendingPayout(creatorId),
      this.getActiveProductCount(creatorId),
      this.getTopProducts(creatorId),
      this.getRevenueSeries(creatorId),
    ]);

    return {
      totals: {
        revenueUsd: settledStats.revenueUsd,
        sales: settledStats.sales,
        activeProducts,
        pendingPayout: pendingStats,
      },
      deltas: {
        revenue: 0,
        sales: 0,
        products: 0,
        payout: 0,
      },
      revenueSeries: revenueDays,
      topProducts: topProductsRaw,
    };
  }

  /**
   * Aggregate settled orders: total revenue + sales count.
   */
  private async getSettledStats(
    creatorId: string,
  ): Promise<{ revenueUsd: string; sales: number }> {
    const result = await this.prisma.order.aggregate({
      where: {
        status: 'SETTLED',
        product: { creatorId },
      },
      _sum: { amountUsd: true },
      _count: { id: true },
    });

    return {
      revenueUsd: result._sum.amountUsd?.toFixed(2) ?? '0.00',
      sales: result._count.id,
    };
  }

  /**
   * Sum of amounts for orders that are paid but not yet settled.
   */
  private async getPendingPayout(creatorId: string): Promise<string> {
    const result = await this.prisma.order.aggregate({
      where: {
        status: { in: ['PAYMENT_RECEIVED', 'SETTLEMENT_PENDING'] },
        product: { creatorId },
      },
      _sum: { amountUsd: true },
    });

    return result._sum.amountUsd?.toFixed(2) ?? '0.00';
  }

  /**
   * Count of products belonging to this creator.
   */
  private async getActiveProductCount(creatorId: string): Promise<number> {
    return this.prisma.product.count({
      where: { creatorId },
    });
  }

  /**
   * Top 5 products by settled order revenue.
   *
   * Uses raw SQL for the GROUP BY product_id aggregation since Prisma's
   * groupBy doesn't support nested relation sums natively.
   */
  private async getTopProducts(
    creatorId: string,
  ): Promise<Array<{ productId: string; productTitle: string; sales: number; revenue: string }>> {
    const rows: Array<{
      product_id: string;
      title: string;
      sales: bigint;
      revenue: string;
    }> = await this.prisma.$queryRawUnsafe(
      `
      SELECT
        p.id AS product_id,
        p.title,
        COUNT(o.id)::bigint AS sales,
        SUM(o.amount_usd)::text AS revenue
      FROM orders o
      JOIN products p ON p.id = o.product_id
      WHERE o.status = 'SETTLED'
        AND p.creator_id = $1
      GROUP BY p.id, p.title
      ORDER BY revenue DESC
      LIMIT 5
      `,
      creatorId,
    );

    return rows.map((r) => ({
      productId: r.product_id,
      productTitle: r.title,
      sales: Number(r.sales),
      revenue: r.revenue ? String(Number(r.revenue).toFixed(2)) : '0.00',
    }));
  }

  /**
   * 30-day revenue series: daily sums of settled order amounts.
   *
   * Queries all settled orders from the trailing 30 days and aggregates
   * by day in JavaScript. Returns all 30 days (zero-filled) so the
   * frontend chart has complete data.
   */
  private async getRevenueSeries(
    creatorId: string,
  ): Promise<Array<{ day: number; amount: string }>> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orders = await this.prisma.order.findMany({
      where: {
        status: 'SETTLED',
        createdAt: { gte: thirtyDaysAgo },
        product: { creatorId },
      },
      select: { amountUsd: true, createdAt: true },
    });

    // Build a map: day-of-series (1-30) → total amount.
    const dayTotals = new Map<number, number>();
    const now = new Date();

    for (const order of orders) {
      const daysAgo = Math.floor(
        (now.getTime() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      // Day 1 = 29-30 days ago (oldest), Day 30 = today.
      const dayIndex = 30 - daysAgo;
      if (dayIndex >= 1 && dayIndex <= 30) {
        const current = dayTotals.get(dayIndex) ?? 0;
        dayTotals.set(dayIndex, current + Number(order.amountUsd));
      }
    }

    return Array.from({ length: 30 }, (_, i) => {
      const day = i + 1;
      const total = dayTotals.get(day) ?? 0;
      return { day, amount: total.toFixed(2) };
    });
  }
}
