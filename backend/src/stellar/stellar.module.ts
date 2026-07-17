import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  loadStellarConfig,
  STELLAR_CONFIG,
  STELLAR_PUBLIC_CONFIG,
  type StellarConfig,
  type StellarPublicConfig,
} from './stellar.config';
import { ExplorerService } from './explorer.service';
import { FloatMonitorService } from './float-monitor.service';
import { PlatformKeypairService } from './platform-keypair.service';
import { HorizonService } from './horizon.service';
import { SorobanRpcService } from './soroban-rpc.service';
import { SettlementService } from './settlement.service';
import { SponsorshipService } from './sponsorship.service';

/**
 * Stellar Module — BE-007.
 *
 * Provides the Stellar integration clients consumed by:
 *   - SettlementService (BE-007): SorobanRpcService.invokeSettle + recording
 *   - Wallet module (BE-008): HorizonService.getUsdcBalance
 *   - Explorer link generation (BE-010): ExplorerService
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
    {
      // Public subset — safe to export. Excludes platformWalletSecret.
      provide: STELLAR_PUBLIC_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StellarPublicConfig => {
        const full = loadStellarConfig((key: string) => config.get<string>(key));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { platformWalletSecret, ...publicConfig } = full;
        return publicConfig;
      },
    },
    PlatformKeypairService,
    HorizonService,
    SorobanRpcService,
    SettlementService,
    SponsorshipService,
    ExplorerService,
    FloatMonitorService,
  ],
  exports: [
    STELLAR_PUBLIC_CONFIG,
    SorobanRpcService,
    HorizonService,
    PlatformKeypairService,
    SettlementService,
    SponsorshipService,
    ExplorerService,
  ],
})
export class StellarModule {}
