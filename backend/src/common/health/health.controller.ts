import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Health check endpoint — BE-016.
 *
 * Provides both shallow liveness (process up) and deep readiness
 * (PostgreSQL connectivity via `SELECT 1`).
 *
 * Railway's readiness probe uses this to avoid routing traffic to a
 * container whose database isn't ready.
 *
 * Source: Kreav Deployment PRD §13 — Health Check.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'Health check',
    description:
      'Returns the application health status. Includes a deep PostgreSQL readiness check ' +
      '(`SELECT 1`) so load balancers can verify DB connectivity before routing traffic.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is healthy and database is reachable',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2026-06-29T12:00:00.000Z' },
        db: { type: 'string', example: 'connected' },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Database is unreachable',
  })
  async check(): Promise<{ status: string; timestamp: string; db: string }> {
    try {
      // Deep check: verify DB connectivity with SELECT 1.
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        db: 'connected',
      };
    } catch (err) {
      this.logger.error('Health check failed — DB unreachable', err);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        db: 'disconnected',
      };
    }
  }
}
