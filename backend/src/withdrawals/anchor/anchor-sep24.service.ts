import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { WithdrawalStatus } from '@prisma/client';
import { STELLAR_CONFIG, type StellarConfig } from '../../stellar/stellar.config';

/** SEP-10 challenge handed to the creator's wallet to sign. */
export interface AnchorChallenge {
  transaction: string;
  networkPassphrase: string;
}

/** SEP-24 interactive withdrawal handle. */
export interface AnchorInteractive {
  /** Anchor-hosted URL for KYC + bank/cash-out details. */
  url: string;
  /** Anchor transaction id — used to poll status. */
  id: string;
}

/** The subset of a SEP-24 transaction the off-ramp flow needs. */
export interface AnchorTransaction {
  id: string;
  status: string;
  /** Present once status === 'pending_user_transfer_start'. */
  withdrawAnchorAccount?: string;
  withdrawMemo?: string;
  withdrawMemoType?: string;
  amountIn?: string;
  moreInfoUrl?: string;
}

/**
 * AnchorSep24Service — thin HTTP client for a Stellar SEP-10 + SEP-24 anchor
 * (Fase 2A off-ramp). Targets the SDF test anchor by default (see stellar.config
 * `anchor*` fields), swappable to MoneyGram via env with no code change.
 *
 * The backend proxies the anchor HTTP so the browser never hits a cross-origin
 * host (CORS-proof) and the anchor JWT flows through our own API. Signing stays
 * client-side: the creator signs the SEP-10 challenge and the USDC payment in
 * Freighter — this service never holds a secret key.
 *
 * Uses global `fetch` (Node 18+) rather than adding an HTTP dependency.
 */
@Injectable()
export class AnchorSep24Service {
  private readonly logger = new Logger(AnchorSep24Service.name);

  constructor(@Inject(STELLAR_CONFIG) private readonly config: StellarConfig) {}

  /** SEP-10: fetch a challenge tx for `account` (the creator signs it). */
  async getAuthChallenge(account: string): Promise<AnchorChallenge> {
    const url = `${this.config.anchorWebAuthUrl}?account=${encodeURIComponent(account)}`;
    const body = await this.getJson<{ transaction?: string; network_passphrase?: string }>(url);
    if (!body.transaction) {
      throw new BadGatewayException('Anchor did not return a SEP-10 challenge');
    }
    return {
      transaction: body.transaction,
      networkPassphrase: body.network_passphrase ?? this.config.networkPassphrase,
    };
  }

  /** SEP-10: exchange the creator-signed challenge for an anchor JWT. */
  async postAuthVerify(signedXdr: string): Promise<string> {
    const body = await this.postJson<{ token?: string }>(this.config.anchorWebAuthUrl, {
      transaction: signedXdr,
    });
    if (!body.token) {
      throw new BadGatewayException('Anchor did not return a SEP-10 token');
    }
    return body.token;
  }

  /** SEP-24: start an interactive USDC withdrawal; returns the hosted URL + id. */
  async withdrawInteractive(
    token: string,
    params: { account: string; amount?: string },
  ): Promise<AnchorInteractive> {
    const url = `${this.config.anchorTransferServerUrl}/transactions/withdraw/interactive`;
    const payload: Record<string, string> = {
      asset_code: this.config.usdcAssetCode,
      account: params.account,
    };
    if (params.amount) payload.amount = params.amount;

    const body = await this.postJson<{ url?: string; id?: string }>(url, payload, token);
    if (!body.url || !body.id) {
      throw new BadGatewayException('Anchor did not return an interactive URL/id');
    }
    return { url: body.url, id: body.id };
  }

  /** SEP-24: read a transaction's current status + transfer instructions. */
  async getTransaction(token: string, id: string): Promise<AnchorTransaction> {
    const url = `${this.config.anchorTransferServerUrl}/transaction?id=${encodeURIComponent(id)}`;
    const body = await this.getJson<{ transaction?: RawAnchorTx }>(url, token);
    const tx = body.transaction;
    if (!tx) {
      throw new BadGatewayException('Anchor did not return a transaction');
    }
    return {
      id: tx.id,
      status: tx.status,
      withdrawAnchorAccount: tx.withdraw_anchor_account,
      withdrawMemo: tx.withdraw_memo,
      withdrawMemoType: tx.withdraw_memo_type,
      amountIn: tx.amount_in,
      moreInfoUrl: tx.more_info_url,
    };
  }

  /**
   * Map a SEP-24 transaction status to our WithdrawalStatus.
   * `completed` → COMPLETED; terminal error states → FAILED; anything mid-flight
   * (incomplete, pending_*) → PROCESSING.
   */
  mapStatus(anchorStatus: string): WithdrawalStatus {
    if (anchorStatus === 'completed') return WithdrawalStatus.COMPLETED;
    if (
      ['error', 'refunded', 'no_market', 'too_small', 'too_large', 'expired'].includes(anchorStatus)
    ) {
      return WithdrawalStatus.FAILED;
    }
    return WithdrawalStatus.PROCESSING;
  }

  // ── HTTP helpers (global fetch) ─────────────────────────────────────────

  private async getJson<T>(url: string, token?: string): Promise<T> {
    return this.request<T>(url, { method: 'GET', headers: this.authHeaders(token) });
  }

  private async postJson<T>(url: string, body: unknown, token?: string): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders(token) },
      body: JSON.stringify(body),
    });
  }

  private authHeaders(token?: string): Record<string, string> {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /** Pull the human message out of a SEP error body (`{ "error": "..." }`). */
  private extractAnchorError(text: string): string | null {
    try {
      const body = JSON.parse(text) as { error?: unknown };
      if (typeof body.error === 'string' && body.error.trim()) return body.error.trim();
    } catch {
      /* non-JSON — fall through */
    }
    return null;
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      this.logger.error(
        `Anchor request failed (${url}): ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadGatewayException('Anchor is unreachable');
    }
    const text = await res.text();
    if (!res.ok) {
      this.logger.error(`Anchor ${res.status} (${url}): ${text.slice(0, 300)}`);
      // Surface the anchor's own message (e.g. "amount is less than asset's
      // minimum limit: 0.2") so the creator sees the actionable reason. A 4xx is
      // the creator's input problem (→ 400); a 5xx is the anchor's (→ 502).
      const reason = this.extractAnchorError(text);
      if (res.status >= 400 && res.status < 500) {
        throw new BadRequestException(reason ? `Anchor: ${reason}` : `Anchor rejected the request`);
      }
      throw new BadGatewayException(reason ? `Anchor: ${reason}` : `Anchor returned ${res.status}`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new BadGatewayException('Anchor returned a non-JSON response');
    }
  }
}

/** Raw SEP-24 transaction fields (snake_case as the anchor returns them). */
interface RawAnchorTx {
  id: string;
  status: string;
  withdraw_anchor_account?: string;
  withdraw_memo?: string;
  withdraw_memo_type?: string;
  amount_in?: string;
  more_info_url?: string;
}
