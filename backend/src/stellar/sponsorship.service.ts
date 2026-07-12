import { BadRequestException, ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import {
  Asset,
  BASE_FEE,
  Horizon,
  Memo,
  Operation,
  Transaction,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { STELLAR_CONFIG, type StellarConfig } from './stellar.config';
import { PlatformKeypairService } from './platform-keypair.service';
import { HorizonService } from './horizon.service';

/** A prepared, platform-signed transaction the creator must co-sign. */
export interface PreparedSponsoredTx {
  /** Base64 XDR — already signed by the platform; the creator adds their signature. */
  xdr: string;
  /** Network passphrase the wallet must sign against (TESTNET for the demo). */
  networkPassphrase: string;
  /** Whether the tx also creates the creator account (true → account did not exist). */
  createsAccount: boolean;
}

/**
 * SponsorshipService — Fase 1.5 (sponsored onboarding).
 *
 * The platform pays the network fee AND sponsors the reserves for a creator's
 * USDC trustline (CAP-33 sponsored reserves), so a creator never needs XLM to
 * start receiving settlements. This is a CLASSIC Stellar operation — the
 * settlement contract is not involved.
 *
 * ## The sponsorship sandwich
 *   [source=platform] beginSponsoringFutureReserves(sponsored=creator)
 *   [source=platform] createAccount(creator, "0")      ← only if account is new
 *   [source=creator ] changeTrust(USDC)                 ← the sponsored reserve
 *   [source=creator ] endSponsoringFutureReserves()
 *
 * The transaction SOURCE is the platform, so the platform pays the fee and
 * consumes its own sequence number. Two signatures are required: the platform
 * (added here at prepare time) and the creator (added by their wallet).
 *
 * ## Anti blind-signing
 * The platform signs ONLY the exact transaction it built here — never an
 * arbitrary XDR handed back by the client. On submit we re-parse and re-validate
 * the structure before relaying, so a tampered tx (which would already have an
 * invalid platform signature) is rejected with a clear error.
 */
@Injectable()
export class SponsorshipService {
  private readonly logger = new Logger(SponsorshipService.name);
  private _server: Horizon.Server | null = null;

  constructor(
    @Inject(STELLAR_CONFIG) private readonly config: StellarConfig,
    private readonly platformKey: PlatformKeypairService,
    private readonly horizon: HorizonService,
  ) {}

  private get server(): Horizon.Server {
    if (!this._server) {
      this._server = new Horizon.Server(this.config.horizonUrl);
    }
    return this._server;
  }

  private get usdc(): Asset {
    return new Asset(this.config.usdcAssetCode, this.config.usdcIssuer);
  }

  /**
   * Build + platform-sign a sponsored USDC-trustline transaction for `creator`.
   *
   * Throws ConflictException if the creator already has the trustline (no-op).
   */
  async prepareSponsoredTrustline(creatorAddress: string): Promise<PreparedSponsoredTx> {
    const state = await this.horizon.getUsdcBalance(creatorAddress);
    if (state.hasUsdcTrustline) {
      throw new ConflictException('Wallet already has a USDC trustline');
    }

    const platform = this.platformKey.getKeypair();
    const platformAccount = await this.server.loadAccount(platform.publicKey());
    const createsAccount = !state.accountExists;

    const builder = new TransactionBuilder(platformAccount, {
      // One BASE_FEE per operation. 3 ops (existing account) or 4 (new account).
      fee: (Number(BASE_FEE) * (createsAccount ? 4 : 3)).toString(),
      networkPassphrase: this.config.networkPassphrase,
    });

    builder.addOperation(
      Operation.beginSponsoringFutureReserves({
        sponsoredId: creatorAddress,
        // source defaults to the tx source (platform) — the sponsor.
      }),
    );

    if (createsAccount) {
      builder.addOperation(
        Operation.createAccount({
          destination: creatorAddress,
          startingBalance: '0', // reserve is covered by the sponsorship, not XLM
        }),
      );
    }

    builder.addOperation(
      Operation.changeTrust({
        asset: this.usdc,
        source: creatorAddress, // the sponsored account owns the trustline
      }),
    );

    builder.addOperation(
      Operation.endSponsoringFutureReserves({
        source: creatorAddress, // must be sourced by the sponsored account
      }),
    );

    const tx = builder.setTimeout(300).build();
    tx.sign(platform); // platform commits to EXACTLY this tx

    this.logger.log(
      `Prepared sponsored trustline for ${creatorAddress.slice(0, 8)}... ` +
        `(createsAccount=${createsAccount})`,
    );

    return {
      xdr: tx.toXDR(),
      networkPassphrase: this.config.networkPassphrase,
      createsAccount,
    };
  }

  /**
   * Validate the creator-signed XDR is the tx we prepared, then relay it.
   *
   * Returns the on-chain transaction hash on success.
   */
  async submitSponsoredTrustline(signedXdr: string, expectedCreator: string): Promise<string> {
    let tx: Transaction;
    try {
      tx = TransactionBuilder.fromXDR(signedXdr, this.config.networkPassphrase) as Transaction;
    } catch {
      throw new BadRequestException('Malformed transaction XDR');
    }

    this.assertIsOurSponsoredTrustline(tx, expectedCreator);

    try {
      const result = await this.server.submitTransaction(tx);
      this.logger.log(
        `Submitted sponsored trustline for ${expectedCreator.slice(0, 8)}...: ${result.hash}`,
      );
      return result.hash;
    } catch (err: unknown) {
      const detail = this.extractHorizonError(err);
      this.logger.error(`Sponsored trustline submission failed: ${detail}`);
      throw new BadRequestException(`Trustline submission failed: ${detail}`);
    }
  }

  /**
   * Build an UNSIGNED USDC payment from the creator to the anchor's withdraw
   * account (Fase 2A off-ramp). The transaction SOURCE is the creator, so the
   * creator pays the fee and signs it in their wallet — the platform is not
   * involved (this is the creator sending their own settled USDC to cash out).
   *
   * The SEP-24 `withdraw_memo`/`withdraw_memo_type` from the anchor must be
   * attached exactly, or the anchor cannot match the deposit to the withdrawal.
   */
  async buildWithdrawPayment(params: {
    from: string;
    to: string;
    amount: string;
    memo?: string;
    memoType?: string;
  }): Promise<{ xdr: string; networkPassphrase: string }> {
    const source = await this.server.loadAccount(params.from);
    const builder = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    });

    builder.addOperation(
      Operation.payment({
        destination: params.to,
        asset: this.usdc,
        amount: params.amount,
      }),
    );

    if (params.memo) {
      builder.addMemo(this.toMemo(params.memo, params.memoType));
    }

    const tx = builder.setTimeout(300).build();
    this.logger.log(
      `Prepared withdraw payment ${params.amount} USDC ${params.from.slice(0, 8)}... → ${params.to.slice(0, 8)}...`,
    );
    return { xdr: tx.toXDR(), networkPassphrase: this.config.networkPassphrase };
  }

  /**
   * Relay a creator-signed withdraw payment. Validates it is a single USDC
   * payment sourced by the creator before submitting, then returns the tx hash.
   */
  async submitWithdrawPayment(signedXdr: string, expectedFrom: string): Promise<string> {
    let tx: Transaction;
    try {
      tx = TransactionBuilder.fromXDR(signedXdr, this.config.networkPassphrase) as Transaction;
    } catch {
      throw new BadRequestException('Malformed transaction XDR');
    }

    if (tx.source !== expectedFrom) {
      throw new BadRequestException('Transaction source is not the authenticated wallet');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK op union is awkward to narrow
    const ops = tx.operations as any[];
    const payment = ops.find((o) => o.type === 'payment');
    if (ops.length !== 1 || !payment) {
      throw new BadRequestException('Transaction is not a single payment operation');
    }
    const asset = payment.asset as Asset | undefined;
    if (
      !asset ||
      asset.getCode?.() !== this.config.usdcAssetCode ||
      asset.getIssuer?.() !== this.config.usdcIssuer
    ) {
      throw new BadRequestException('Payment asset is not the configured USDC');
    }

    try {
      const result = await this.server.submitTransaction(tx);
      this.logger.log(`Submitted withdraw payment for ${expectedFrom.slice(0, 8)}...: ${result.hash}`);
      return result.hash;
    } catch (err: unknown) {
      const detail = this.extractHorizonError(err);
      this.logger.error(`Withdraw payment submission failed: ${detail}`);
      throw new BadRequestException(`Withdraw payment failed: ${detail}`);
    }
  }

  /** Map a SEP-24 memo (text/id/hash) to a Stellar Memo. */
  private toMemo(memo: string, memoType?: string): Memo {
    if (memoType === 'hash') return Memo.hash(Buffer.from(memo, 'base64'));
    if (memoType === 'id') return Memo.id(memo);
    return Memo.text(memo);
  }

  /**
   * Defense-in-depth structural check. The platform already signed only the tx
   * it built, so a tampered tx fails signature verification on-chain anyway —
   * this rejects it earlier with an actionable message and prevents relaying an
   * unrelated transaction.
   */
  private assertIsOurSponsoredTrustline(tx: Transaction, expectedCreator: string): void {
    const platformPublic = this.platformKey.getPublicKey();

    if (tx.source !== platformPublic) {
      throw new BadRequestException('Transaction source is not the platform account');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK op union is awkward to narrow
    const ops = tx.operations as any[];
    const types = ops.map((o) => o.type);

    const hasBegin = types.includes('beginSponsoringFutureReserves');
    const hasEnd = types.includes('endSponsoringFutureReserves');
    const changeTrust = ops.find((o) => o.type === 'changeTrust');

    if (!hasBegin || !hasEnd || !changeTrust) {
      throw new BadRequestException('Transaction is not a sponsored-trustline operation');
    }

    // beginSponsoring must sponsor the expected creator.
    const begin = ops.find((o) => o.type === 'beginSponsoringFutureReserves');
    if (begin.sponsoredId !== expectedCreator) {
      throw new BadRequestException('Sponsored account does not match the authenticated wallet');
    }

    // changeTrust must be for OUR USDC and sourced by the creator.
    const line = changeTrust.line as Asset | undefined;
    if (
      !line ||
      line.getCode?.() !== this.config.usdcAssetCode ||
      line.getIssuer?.() !== this.config.usdcIssuer
    ) {
      throw new BadRequestException('Trustline asset is not the configured USDC');
    }
    if (changeTrust.source !== expectedCreator) {
      throw new BadRequestException('Trustline is not owned by the authenticated wallet');
    }
  }

  /** Pull a readable message out of a Horizon submission error. */
  private extractHorizonError(err: unknown): string {
    if (typeof err === 'object' && err !== null) {
      const codes = (err as { response?: { data?: { extras?: { result_codes?: unknown } } } })
        .response?.data?.extras?.result_codes;
      if (codes) return JSON.stringify(codes);
      const msg = (err as { message?: string }).message;
      if (msg) return msg;
    }
    return String(err);
  }
}
