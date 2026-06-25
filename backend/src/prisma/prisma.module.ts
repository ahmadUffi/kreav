import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global module exposing {@link PrismaService} to every feature module without
 * requiring each one to re-import it.
 *
 * Source: Kreav Backend PRD v3 — Section 7.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
