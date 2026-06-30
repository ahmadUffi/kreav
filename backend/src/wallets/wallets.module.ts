import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StellarModule } from '../stellar/stellar.module';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

/**
 * Wallet Module — BE-008.
 *
 * Endpoints:
 *   GET /wallet/balance        — USDC balance from Horizon (read-only)
 *   GET /wallet/transactions   — settlement history from DB (read-only)
 *
 * Non-custodial: the backend stores only public keys.
 *
 * Source: Kreav Backend PRD v3 — §6 Wallet Module + §9 Wallet APIs.
 */
@Module({
  imports: [PrismaModule, StellarModule],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
