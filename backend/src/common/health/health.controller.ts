import { Controller, Get } from '@nestjs/common';

/**
 * Lightweight liveness/readiness probe.
 * The demo and CI hit this to confirm the app booted.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
