import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StellarModule } from '../stellar/stellar.module';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';

/**
 * Withdrawals Module — BE-009.
 *
 * Simulated Anchor off-ramp for the Stellar Hackathon MVP.
 *
 * Endpoints:
 *   POST /withdrawals       — request withdrawal (simulated)
 *   GET  /withdrawals/:id   — get withdrawal receipt
 *   GET  /withdrawals       — list withdrawals (paginated)
 *
 * Key design:
 *   - No real USDC ever moves (simulated Anchor)
 *   - Lazy status transition (no setTimeout)
 *   - Internal withdrawable balance ledger
 *   - Simulation transparency in every receipt
 *
 * Source: Kreav Backend PRD v3 — §9 Withdrawal APIs.
 */
@Module({
  imports: [PrismaModule, StellarModule],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
