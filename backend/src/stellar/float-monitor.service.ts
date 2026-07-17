import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { STELLAR_CONFIG, type StellarConfig } from './stellar.config';
import { HorizonService } from './horizon.service';

/**
 * Minimum USDC float threshold. When the platform wallet drops below this,
 * the monitor emits a warning log so the team can top up before the demo fails.
 */
const FLOAT_WARNING_THRESHOLD = 50;

/**
 * How often to check the platform float (milliseconds). Every 60 seconds.
 */
const CHECK_INTERVAL_MS = 60_000;

/**
 * FloatMonitorService — BE-017.
 *
 * Periodically reads the platform wallet's USDC balance from Horizon and logs
 * a warning when the float drops below the threshold.
 *
 * The platform float is a pre-funded USDC balance that funds settlements
 * (since the buyer's GCash payment is mocked — ADR C1). If the float runs dry,
 * the Soroban `settle` invocation reverts with INSUFFICIENT_FLOAT.
 *
 * Source: Kreav Observability PRD §9 — Float monitoring.
 */
@Injectable()
export class FloatMonitorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FloatMonitorService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(STELLAR_CONFIG) private readonly config: StellarConfig,
    private readonly horizon: HorizonService,
  ) {}

  onApplicationBootstrap(): void {
    // Only start monitoring if the platform wallet is configured.
    if (!this.config.platformWalletAddress) {
      this.logger.warn('Platform wallet address not configured — float monitor disabled.');
      return;
    }

    // Run an initial check, then every CHECK_INTERVAL_MS.
    this.checkFloat();
    this.timer = setInterval(() => this.checkFloat(), CHECK_INTERVAL_MS);

    this.logger.log(
      `Float monitor started — checking ${this.config.platformWalletAddress.slice(0, 8)}... every ${CHECK_INTERVAL_MS / 1000}s`,
    );

    // Allow the Node process to exit even if the timer is still active.
    if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
      this.timer.unref();
    }
  }

  /**
   * Read the platform wallet USDC balance from Horizon.
   * Logs a warning if the float is low or the check fails.
   */
  private async checkFloat(): Promise<void> {
    try {
      const result = await this.horizon.getUsdcBalance(this.config.platformWalletAddress);

      const balanceNum = parseFloat(result.balanceUsd);

      if (isNaN(balanceNum)) {
        this.logger.error(
          `[FLOAT] Failed to parse USDC balance "${result.balanceUsd}" — check Horizon response`,
        );
        return;
      }

      if (!result.accountExists) {
        this.logger.warn(
          `[FLOAT] Platform account ${this.config.platformWalletAddress.slice(0, 8)}... does not exist on network. Fund it with XLM first.`,
        );
        return;
      }

      if (!result.hasUsdcTrustline) {
        this.logger.warn(
          `[FLOAT] Platform account ${this.config.platformWalletAddress.slice(0, 8)}... has no USDC trustline. Create one before settlements.`,
        );
        return;
      }

      if (balanceNum < FLOAT_WARNING_THRESHOLD) {
        this.logger.warn(
          `[FLOAT] LOW BALANCE — ${balanceNum.toFixed(2)} USDC (threshold: ${FLOAT_WARNING_THRESHOLD}). ` +
            `Each settlement consumes ~10 USDC. Top up via BC-011 before the demo.`,
        );
      } else {
        this.logger.log(`[FLOAT] OK — ${balanceNum.toFixed(2)} USDC`);
      }
    } catch (err) {
      this.logger.error(
        `[FLOAT] Check failed — Horizon unreachable? ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
