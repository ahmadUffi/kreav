import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AnalyticsResponseDto } from './dto';

/**
 * AnalyticsController — BE-019 + Fase 1 (token-scoped identity).
 *
 *   GET /analytics  — dashboard KPIs for the authenticated creator (JWT)
 *
 * Aggregates data from the Order, Product, and Settlement tables.
 * Deltas return 0 for MVP (period-over-period comparison deferred).
 *
 * Source: BE-019 — Dashboard Analytics API + ROADMAP Fase 1.
 */
@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analytics: AnalyticsService) {}

  /**
   * GET /analytics — KPIs scoped to the authenticated creator.
   */
  @Get()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Get dashboard analytics',
    description:
      'Returns aggregated dashboard KPIs for the authenticated creator: ' +
      'totals (revenue, sales, active products, pending payout), ' +
      '30-day revenue time series, and top 5 products by revenue. ' +
      'Deltas return 0 for MVP (period-over-period comparison deferred). ' +
      'All monetary values are strings (Decimal serialization).',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics retrieved successfully',
    type: AnalyticsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid bearer token' })
  async getAnalytics(@CurrentUser() user: AuthUser): Promise<AnalyticsResponseDto> {
    this.logger.log(`GET /analytics user=${user.userId}`);
    return this.analytics.getAnalytics(user.userId);
  }
}
