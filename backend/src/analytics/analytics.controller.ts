import {
  Controller,
  Get,
  Logger,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto, AnalyticsResponseDto } from './dto';

/**
 * AnalyticsController — BE-019.
 *
 *   GET /analytics  — dashboard KPIs (totals, revenue series, top products)
 *
 * Aggregates data from the Order, Product, and Settlement tables.
 * Deltas return 0 for MVP (period-over-period comparison deferred).
 *
 * Source: BE-019 — Dashboard Analytics API.
 */
@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analytics: AnalyticsService) {}

  /**
   * GET /analytics?creatorId=<uuid>
   *
   * Returns all dashboard KPIs: totals (revenue, sales, products, pending),
   * 30-day revenue series, and top 5 products by revenue.
   */
  @Get()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Get dashboard analytics',
    description:
      'Returns aggregated dashboard KPIs for a creator: ' +
      'totals (revenue, sales, active products, pending payout), ' +
      '30-day revenue time series, and top 5 products by revenue. ' +
      'Deltas return 0 for MVP (period-over-period comparison deferred). ' +
      'All monetary values are strings (Decimal serialization).',
  })
  @ApiQuery({
    name: 'creatorId',
    description: 'Creator user ID (UUID) to scope analytics to',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics retrieved successfully',
    type: AnalyticsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid creatorId format — must be a valid UUID',
  })
  async getAnalytics(@Query() query: AnalyticsQueryDto): Promise<AnalyticsResponseDto> {
    this.logger.log(`GET /analytics?creatorId=${query.creatorId}`);
    return this.analytics.getAnalytics(query.creatorId);
  }
}
