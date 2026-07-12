import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

/**
 * Analytics Module — BE-019.
 *
 * Endpoints:
 *   GET /analytics  — dashboard KPIs and aggregation data
 *
 * Aggregates from Order, Product, and Settlement tables.
 * Read-only — no mutations.
 *
 * Source: BE-019 — Dashboard Analytics API.
 */
@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
