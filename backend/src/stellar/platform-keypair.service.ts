import { Inject, Injectable, Logger } from '@nestjs/common';
import { Keypair } from '@stellar/stellar-sdk';
import { STELLAR_CONFIG, type StellarConfig } from './stellar.config';

/**
 * PlatformKeypairService — loads the platform account keypair ONCE from the
 * server-side secret (ADR H1 / ED-10).
 *
 * This is the single highest-value secret in Kreav (Security PRD §16). It
 * signs every settlement transaction. Accessible only within the stellar module;
 * the SettlementService (BE-007B) consumes it.
 *
 * The keypair is loaded lazily (first access) so a missing/invalid secret fails
 * at the first settlement attempt, not at boot — allowing the app to start for
 * non-settlement work (e.g. product APIs) without the secret configured in dev.
 */
@Injectable()
export class PlatformKeypairService {
  private readonly logger = new Logger(PlatformKeypairService.name);
  private keypair: Keypair | null = null;

  constructor(@Inject(STELLAR_CONFIG) private readonly config: StellarConfig) {}

  /**
   * Returns the platform Keypair. Throws if the secret is missing/invalid.
   * The error is descriptive so a misconfigured env is obvious.
   */
  getKeypair(): Keypair {
    if (this.keypair) {
      return this.keypair;
    }
    const secret = this.config.platformWalletSecret;
    if (!secret) {
      throw new Error(
        'PLATFORM_WALLET_SECRET is not set. Settlement cannot sign transactions. ' +
          'See docs/stellar/Stellar-Standards-PRD.md ED-10.',
      );
    }
    try {
      this.keypair = Keypair.fromSecret(secret);
      this.logger.log(`Platform keypair loaded for ${this.keypair.publicKey().slice(0, 8)}...`);
      return this.keypair;
    } catch {
      throw new Error(
        'PLATFORM_WALLET_SECRET is not a valid Stellar secret key (S...). ' +
          'Settlement cannot proceed.',
      );
    }
  }

  /** Public key (G...) — safe to log/share. */
  getPublicKey(): string {
    return this.getKeypair().publicKey();
  }
}
