import { ApiProperty } from '@nestjs/swagger';

/**
 * A single data point in the 30-day revenue series.
 */
class RevenuePointDto {
  @ApiProperty({ description: 'Day index (1 = oldest)', example: 1 })
  day!: number;

  @ApiProperty({ description: 'Revenue in USD (string for Decimal)', example: '120.00' })
  amount!: string;
}

/**
 * A top-selling product entry.
 */
class TopProductDto {
  @ApiProperty({ description: 'Product ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  productId!: string;

  @ApiProperty({ description: 'Product title', example: 'Lightroom Sunset Presets' })
  productTitle!: string;

  @ApiProperty({ description: 'Number of sales', example: 41 })
  sales!: number;

  @ApiProperty({ description: 'Total revenue in USD', example: '738.00' })
  revenue!: string;
}

/**
 * KPI totals for the dashboard stat cards.
 */
class AnalyticsTotalsDto {
  @ApiProperty({ description: 'Total revenue (USD)', example: '4218.00' })
  revenueUsd!: string;

  @ApiProperty({ description: 'Total number of sales (settled orders)', example: 186 })
  sales!: number;

  @ApiProperty({ description: 'Number of active products', example: 8 })
  activeProducts!: number;

  @ApiProperty({ description: 'Pending payout (USD) — unsettled orders', example: '312.50' })
  pendingPayout!: string;
}

/**
 * Percentage change vs previous period. Returns 0 for MVP.
 */
class AnalyticsDeltasDto {
  @ApiProperty({ description: 'Revenue change (%)', example: 0 })
  revenue!: number;

  @ApiProperty({ description: 'Sales change (%)', example: 0 })
  sales!: number;

  @ApiProperty({ description: 'Active products change (%)', example: 0 })
  products!: number;

  @ApiProperty({ description: 'Pending payout change (%)', example: 0 })
  payout!: number;
}

/**
 * Response for GET /analytics.
 *
 * Returns dashboard KPIs, revenue time series, and top products.
 * Deltas return 0 for MVP (period-over-period comparison deferred).
 *
 * Source: BE-019 — Dashboard Analytics API.
 */
export class AnalyticsResponseDto {
  @ApiProperty({ description: 'KPI totals', type: AnalyticsTotalsDto })
  totals!: AnalyticsTotalsDto;

  @ApiProperty({ description: 'Percentage change vs previous period', type: AnalyticsDeltasDto })
  deltas!: AnalyticsDeltasDto;

  @ApiProperty({
    description: '30-day revenue time series',
    type: [RevenuePointDto],
  })
  revenueSeries!: RevenuePointDto[];

  @ApiProperty({
    description: 'Top 5 products by revenue',
    type: [TopProductDto],
  })
  topProducts!: TopProductDto[];
}
