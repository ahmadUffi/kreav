import { Inject, Injectable } from '@nestjs/common';
import { STELLAR_CONFIG, type StellarConfig } from './stellar.config';

/**
 * ExplorerService — BE-010.
 *
 * Generates Stellar block explorer URLs from transaction hashes.
 * Uses the explorer base URL from StellarConfig (defaults to stellar.expert testnet).
 *
 * Source: Kreav Backend PRD v3 — §9 Explorer Integration.
 */
@Injectable()
export class ExplorerService {
  constructor(@Inject(STELLAR_CONFIG) private readonly config: StellarConfig) {}

  /**
   * Build a full explorer URL for a Stellar transaction hash.
   *
   * @param txHash — the settlement transaction hash
   * @returns a fully-qualified URL, e.g.
   *   "https://stellar.expert/explorer/testnet/tx/a1b2c3d4e5f6..."
   */
  txUrl(txHash: string): string {
    return `${this.config.explorerUrl}/tx/${txHash}`;
  }
}
