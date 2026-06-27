import { Inject, Injectable } from '@nestjs/common';
import { Horizon } from '@stellar/stellar-sdk';
import { STELLAR_CONFIG, type StellarConfig } from './stellar.config';

/**
 * The shape returned by getUsdcBalance — the Wallet module (BE-008) consumes this.
 */
export interface WalletBalanceResult {
  /** USDC balance as a string (e.g. "9.50") — or "0" if no trustline/asset. */
  balanceUsd: string;
  /** True if the account has a USDC trustline (can receive USDC). */
  hasUsdcTrustline: boolean;
  /** True if the account exists on-chain (is funded). */
  accountExists: boolean;
}

/**
 * Minimal shape of a credit-asset balance line (for the USDC lookup).
 * The SDK's BalanceLine union makes clean type-narrowing awkward in a find();
 * we cast to this shape instead.
 */
interface CreditBalance {
  asset_code: string;
  asset_issuer: string;
  balance: string;
  asset_type: string;
}

/**
 * HorizonService — reads account state from Horizon (ADR-005: secondary).
 *
 * Used by:
 * - Wallet module (BE-008): GET /wallet/balance (live USDC balance).
 * - Settlement pre-check (BE-007B): does the creator have a USDC trustline?
 *
 * Balance truth = live Horizon read; never cached as authoritative (ADR-007).
 */
@Injectable()
export class HorizonService {
  private _server: Horizon.Server | null = null;

  constructor(@Inject(STELLAR_CONFIG) private readonly config: StellarConfig) {}

  /** Lazily initialize the Horizon server to avoid crash on empty config URL. */
  private get server(): Horizon.Server {
    if (!this._server) {
      this._server = new Horizon.Server(this.config.horizonUrl);
    }
    return this._server;
  }

  /**
   * Load an account's balances from Horizon.
   * Throws on network errors (caller handles retry/timeout — Backend PRD §20).
   */
  async loadAccount(publicKey: string): Promise<Horizon.AccountResponse> {
    return this.server.loadAccount(publicKey);
  }

  /**
   * Get the USDC balance + trustline status for a wallet address.
   * - account not found → accountExists=false, balance "0", no trustline.
   * - account found, no USDC balance → balance "0", hasUsdcTrustline=false.
   *
   * Money returned as a string ("9.50") per API Standards §8.
   */
  async getUsdcBalance(publicKey: string): Promise<WalletBalanceResult> {
    let account: Horizon.AccountResponse;
    try {
      account = await this.server.loadAccount(publicKey);
    } catch (err: unknown) {
      // 404 = account not funded (exists=false). Other errors propagate.
      if (this.isNotFoundError(err)) {
        return { balanceUsd: '0', hasUsdcTrustline: false, accountExists: false };
      }
      throw err;
    }

    // Find the USDC credit balance among all balance lines (native/asset/liquidity).
    // The SDK's BalanceLine union makes a clean type-guard awkward; we cast to a
    // minimal shape and check the asset identity.
    const usdcBalance = account.balances
      .map((b) => b as unknown as CreditBalance)
      .find(
        (b) =>
          b.asset_code === this.config.usdcAssetCode && b.asset_issuer === this.config.usdcIssuer,
      );

    return {
      balanceUsd: usdcBalance ? usdcBalance.balance : '0',
      hasUsdcTrustline: !!usdcBalance,
      accountExists: true,
    };
  }

  /** Type guard for Horizon's "account not found" error. */
  private isNotFoundError(err: unknown): boolean {
    if (typeof err !== 'object' || err === null) return false;
    const response = (err as { response?: { status?: number } }).response;
    return response?.status === 404;
  }
}
