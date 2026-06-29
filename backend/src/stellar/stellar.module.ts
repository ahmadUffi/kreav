import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { loadStellarConfig, STELLAR_CONFIG, type StellarConfig } from './stellar.config';
import { PlatformKeypairService } from './platform-keypair.service';
import { HorizonService } from './horizon.service';
import { SorobanRpcService } from './soroban-rpc.service';

/**
 * Stellar Module — BE-007A.
 *
 * Provides the Stellar integration clients consumed by:
 *   - SettlementService (BE-007B/C): SorobanRpcService.invokeSettle
 *   - Wallet module (BE-008): HorizonService.getUsdcBalance
 *
 * ADR-005: RPC primary (Soroban invoke/verify), Horizon secondary (balance/trustline).
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      // Load + validate Stellar env vars into a typed StellarConfig (fail fast).
      provide: STELLAR_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StellarConfig =>
        loadStellarConfig((key: string) => config.get<string>(key)),
    },
    PlatformKeypairService,
    HorizonService,
    SorobanRpcService,
  ],
  exports: [STELLAR_CONFIG, SorobanRpcService, HorizonService, PlatformKeypairService],
})
export class StellarModule {}
