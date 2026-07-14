import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { StellarModule } from '../../stellar/stellar.module';
import { StartupRecoveryService } from './startup-recovery.service';

/**
 * Startup Module — BE-012 (audit #18).
 *
 * Registers the StartupRecoveryService that recovers stuck orders
 * (PAYMENT_RECEIVED / SETTLEMENT_PENDING) on application bootstrap.
 *
 * Source: Kreav Security PRD §5 — audit #18.
 */
@Module({
  imports: [PrismaModule, StellarModule],
  providers: [StartupRecoveryService],
})
export class StartupModule {}
