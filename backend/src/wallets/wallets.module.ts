import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StellarModule } from '../stellar/stellar.module';
import { WalletsController } from './wallets.controller';
import { WalletsConnectController } from './wallets-connect.controller';
import { WalletsService } from './wallets.service';

/**
 * Wallet Module — BE-008 + BE-020.
 *
 * Endpoints:
 *   GET  /wallet/balance       — USDC balance from Horizon (read-only)
 *   GET  /wallet/transactions  — settlement history from DB (read-only)
 *   POST /wallets              — connect a Stellar wallet (BE-020)
 *
 * Non-custodial: the backend stores only public keys.
 *
 * Source: Kreav Backend PRD v3 — §6 Wallet Module + §9 Wallet APIs + BE-020.
 */
@Module({
  imports: [PrismaModule, StellarModule],
  controllers: [WalletsController, WalletsConnectController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
