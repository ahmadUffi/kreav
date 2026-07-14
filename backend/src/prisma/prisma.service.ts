import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Application-wide Prisma client.
 *
 * Connects lazily on module init and disconnects cleanly on module destroy so
 * we never leak DB connections across hot reloads / graceful shutdowns.
 *
 * Source: Kreav Backend PRD v3 — Section 7 (prisma module), Section 4
 * (PostgreSQL = application state).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      // emit: 'stdout' routes Prisma logs straight to the console.
      // NOTE: do NOT use emit: 'event' here — it activates Prisma's event
      // emitter, and without an attached $on listener this leaks events and
      // triggers a Prisma 6 deprecation warning.
      log: [
        { level: 'warn', emit: 'stdout' },
        { level: 'error', emit: 'stdout' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('✅ Connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL');
  }
}
