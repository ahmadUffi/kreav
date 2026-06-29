import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  Address,
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { STELLAR_CONFIG, type StellarConfig } from './stellar.config';
import { PlatformKeypairService } from './platform-keypair.service';

/**
 * Result of a contract invocation — the SettlementService (BE-007B/C) consumes this.
 */
export interface InvokeResult {
  /** The on-chain transaction hash (the explorer-link source). */
  txHash: string;
  /** 'SUCCESS' (settled) or 'FAILED' (contract reverted / on-chain error). */
  status: 'SUCCESS' | 'FAILED';
  /** The raw contract return value (xdr.ScVal) — SettlementService parses it. */
  returnValue?: xdr.ScVal;
  /** Error details if status=FAILED. */
  errorResultXdr?: string;
}

/**
 * A recipient of a settlement (mirrors the contract's Recipient vec entry).
 * `shareBps` = basis points of the creator pool (sum 10000 = 100%).
 * Only `address` + `shareBps` are sent to the contract — the `role` field
 * was removed from the contract per the canonical contract design.
 */
export interface RecipientInput {
  /** Stellar wallet address (G...) or contract address (C...). */
  address: string;
  /** Share of the creator pool in basis points. e.g. 5000 = 50%. Requires i128 in the contract. */
  shareBps: number;
}

/**
 * SorobanRpcService — the canonical Soroban invocation client (ADR-005).
 *
 * Implements the MANDATORY pattern from the Stellar Skills (data/dapp):
 *   getAccount → build → simulateTransaction → assembleTransaction
 *   → sign(platform key) → sendTransaction → poll getTransaction
 *
 * Never submits a raw unsimulated invoke (the network rejects it).
 * Retries are on VERIFICATION (getTransaction poll), never re-invocation —
 * a re-invoke of a successful settle risks double-settlement. The contract's
 * `order_ref` guard is the last line of defense (Soroban Contract PRD §9).
 *
 * Source: docs/stellar/Soroban-Contract-PRD.md §10.
 */
@Injectable()
export class SorobanRpcService {
  private readonly logger = new Logger(SorobanRpcService.name);
  private _server: rpc.Server | null = null;
  private _contract: Contract | null = null;

  /** Poll config for getTransaction — bounded so we never loop forever. */
  private static readonly POLL_INTERVAL_MS = 1000;
  private static readonly POLL_MAX_ATTEMPTS = 30; // ~30s ledger window

  constructor(
    @Inject(STELLAR_CONFIG) private readonly config: StellarConfig,
    private readonly platformKey: PlatformKeypairService,
  ) {}

  /**
   * Lazily initialize the RPC server & contract reference.
   * Defers SDK object construction to first use so that the service can be
   * injected (and the module compiled) even when Stellar env vars are not set.
   */
  private get server(): rpc.Server {
    if (!this._server) {
      this._server = new rpc.Server(this.config.sorobanRpcUrl);
    }
    return this._server;
  }

  private get contract(): Contract {
    if (!this._contract) {
      this._contract = new Contract(this.config.splitContractId);
    }
    return this._contract;
  }

  /**
   * Invoke the `settle` contract function.
   *
   * Matches the canonical contract's public API:
   *   settle(order_ref: String, total_amount: i128, recipients: Vec<Recipient>)
   *
   * The contract reads `usdc_sac` and `source` (platform_wallet) from its own
   * instance storage — they are NOT passed as parameters (defense against
   * misconfiguration). The contract computes all amounts from `shareBps`.
   *
   * @param orderRef   the Order.id UUID (the contract's idempotency key)
   * @param totalAmountBase  total USDC in base units (7 decimals)
   * @param recipients the creator-pool allocations (shares sum to 10000 bps)
   * @returns the on-chain result (txHash + status)
   *
   * Throws on simulation error (→ SETTLEMENT_FAILED, no retry) or
   * network error during submit (→ SETTLEMENT_FAILED).
   */
  async invokeSettle(
    orderRef: string,
    totalAmountBase: bigint,
    recipients: RecipientInput[],
  ): Promise<InvokeResult> {
    const platformKeypair = this.platformKey.getKeypair();
    const sourceAccount = await this.server.getAccount(platformKeypair.publicKey());

    // 1. Build the invoke transaction (3 args: order_ref, total_amount, recipients).
    const args = this.buildSettleArgs(
      orderRef,
      totalAmountBase,
      recipients,
    );

    let tx = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(this.contract.call('settle', ...args))
      .setTimeout(180)
      .build();

    // 2. Simulate (mandatory — never submit raw).
    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      this.logger.error(
        `settle simulation failed (orderRef=${orderRef}): ${JSON.stringify(sim.error)}`,
      );
      throw new SettlementSimulationError(sim.error);
    }

    // 3. Assemble with the simulation's resource footprint.
    tx = rpc.assembleTransaction(tx, sim).build();

    // 4. Sign with the platform key + submit.
    tx.sign(platformKeypair);
    const sendResp = await this.server.sendTransaction(tx);

    if (sendResp.status === 'ERROR') {
      const errDetail = sendResp.errorResult
        ? sendResp.errorResult.result().toXDR('base64')
        : 'unknown';
      this.logger.error(`settle submission error (orderRef=${orderRef}): ${errDetail}`);
      throw new SettlementSubmissionError(errDetail);
    }

    // 5. Poll getTransaction until non-NOT_FOUND.
    const txHash = sendResp.hash;
    this.logger.log(`settle submitted (orderRef=${orderRef}, txHash=${txHash}); polling...`);
    return this.pollTransaction(txHash, orderRef);
  }

  /**
   * Poll getTransaction until the tx is confirmed or failed.
   * Bounded by POLL_MAX_ATTEMPTS to avoid infinite loops.
   */
  private async pollTransaction(txHash: string, orderRef: string): Promise<InvokeResult> {
    for (let attempt = 0; attempt < SorobanRpcService.POLL_MAX_ATTEMPTS; attempt++) {
      await this.sleep(SorobanRpcService.POLL_INTERVAL_MS);

      const result = await this.server.getTransaction(txHash);
      if (result.status === 'NOT_FOUND') {
        continue; // ledger not yet included — keep polling
      }

      if (result.status === 'SUCCESS') {
        this.logger.log(`settle SUCCESS (orderRef=${orderRef}, txHash=${txHash})`);
        return {
          txHash,
          status: 'SUCCESS',
          returnValue: result.returnValue,
        };
      }

      // FAILED — SDK v16 GetFailedTransactionResponse has resultXdr (xdr.TransactionResult)
      this.logger.error(`settle FAILED on-chain (orderRef=${orderRef}, txHash=${txHash})`);
      return {
        txHash,
        status: 'FAILED',
        errorResultXdr: result.resultXdr.toXDR('base64'),
      };
    }

    // Timed out — tx still NOT_FOUND after ~30s (network congestion / dropped).
    this.logger.warn(
      `settle poll timed out (orderRef=${orderRef}, txHash=${txHash}) — tx may still confirm later.`,
    );
    throw new SettlementTimeoutError(txHash);
  }

  /**
   * Build the scVal args for the `settle` function.
   *
   * New contract API: settle(order_ref: String, total_amount: i128, recipients: Vec<Recipient>)
   *   where Recipient = { address: Address, share_bps: i128 }
   *
   * The contract reads `usdc_sac` and `platform_wallet` from its own storage.
   * We only pass the three dynamic arguments.
   */
  private buildSettleArgs(
    orderRef: string,
    totalAmountBase: bigint,
    recipients: RecipientInput[],
  ): xdr.ScVal[] {
    // Build the recipients Vec<Recipient> where Recipient { address, share_bps }
    // Note: no `role` field — it was removed from the canonical contract.
    const recipientsScVals = recipients.map((r) =>
      xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('address'),
          val: new Address(r.address).toScVal(),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('share_bps'),
          val: nativeToScVal(r.shareBps, { type: 'i128' }),
        }),
      ]),
    );
    const recipientsVec = xdr.ScVal.scvVec(recipientsScVals);

    // i128 via nativeToScVal (handles lo/hi split internally)
    const totalAmountScVal = nativeToScVal(totalAmountBase, { type: 'i128' });

    // order_ref as String (not Symbol — UUIDs are 36 chars > Symbol's 32-char limit)
    const orderRefScVal = xdr.ScVal.scvString(orderRef);

    return [
      orderRefScVal,
      totalAmountScVal,
      recipientsVec,
    ];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/** Simulation failed — a logic error (bad args, contract panic). No retry. */
export class SettlementSimulationError extends Error {
  constructor(public readonly details: unknown) {
    super('Soroban settlement simulation failed');
    this.name = 'SettlementSimulationError';
  }
}

/** Submission was rejected by the network (bad tx / insufficient fee / etc). */
export class SettlementSubmissionError extends Error {
  constructor(public readonly errorResultXdr: string) {
    super('Soroban settlement submission rejected');
    this.name = 'SettlementSubmissionError';
  }
}

/** Polling timed out — tx still NOT_FOUND after the budget. May confirm later. */
export class SettlementTimeoutError extends Error {
  constructor(public readonly txHash: string) {
    super(`Soroban settlement verification timed out (txHash=${txHash})`);
    this.name = 'SettlementTimeoutError';
  }
}
