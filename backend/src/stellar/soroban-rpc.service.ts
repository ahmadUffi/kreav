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
 * `shareBps` = basis points within the creator pool (sum 10000 = 100%).
 */
export interface SettlementRecipientInput {
  address: string; // G...
  role: string; // free-text ("Author", "Platform", ...)
  shareBps: number; // e.g. 9500 for 95%
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
  private readonly server: rpc.Server;
  private readonly contract: Contract;

  /** Poll config for getTransaction — bounded so we never loop forever. */
  private static readonly POLL_INTERVAL_MS = 1000;
  private static readonly POLL_MAX_ATTEMPTS = 30; // ~30s ledger window

  constructor(
    @Inject(STELLAR_CONFIG) private readonly config: StellarConfig,
    private readonly platformKey: PlatformKeypairService,
  ) {
    this.server = new rpc.Server(config.sorobanRpcUrl);
    this.contract = new Contract(config.splitContractId);
  }

  /**
   * Invoke the `settle` contract function.
   *
   * @param orderRef   the Order.id UUID (ADR H2 idempotency key)
   * @param totalAmountBase  total USDC in base units (7 decimals; ED-7)
   * @param recipients the creator-pool recipients (shares sum to 10000 bps)
   * @param usdcSacAddress  the USDC SAC contract address (C...) — separate from the split contract
   * @returns the on-chain result (txHash + status + returnValue)
   *
   * Throws on simulation error (→ SETTLEMENT_FAILED, no retry) or
   * network error during submit (→ SETTLEMENT_FAILED).
   */
  async invokeSettle(
    orderRef: string,
    totalAmountBase: bigint,
    recipients: SettlementRecipientInput[],
    usdcSacAddress: string,
  ): Promise<InvokeResult> {
    const platformKeypair = this.platformKey.getKeypair();
    const sourceAccount = await this.server.getAccount(platformKeypair.publicKey());

    // 1. Build the invoke transaction.
    const args = this.buildSettleArgs(
      platformKeypair.publicKey(),
      orderRef,
      totalAmountBase,
      recipients,
      usdcSacAddress,
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
   * settle(usdc_sac: Address, source: Address, order_ref: Symbol,
   *        total_amount: i128, recipients: Vec<Recipient>)
   */
  private buildSettleArgs(
    sourcePublicKey: string,
    orderRef: string,
    totalAmountBase: bigint,
    recipients: SettlementRecipientInput[],
    usdcSacAddress: string,
  ): xdr.ScVal[] {
    const sourceAddress = new Address(sourcePublicKey);
    const sacAddress = new Address(usdcSacAddress);

    // Build the recipients Vec<Recipient> where Recipient { address, role, share_bps }
    const recipientsScVals = recipients.map((r) =>
      xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('address'),
          val: new Address(r.address).toScVal(),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('role'),
          val: xdr.ScVal.scvSymbol(r.role),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('share_bps'),
          val: xdr.ScVal.scvU32(r.shareBps),
        }),
      ]),
    );
    const recipientsVec = xdr.ScVal.scvVec(recipientsScVals);

    // i128 via nativeToScVal (handles lo/hi split internally)
    const totalAmountScVal = nativeToScVal(totalAmountBase, { type: 'i128' });

    return [
      sacAddress.toScVal(),
      sourceAddress.toScVal(),
      xdr.ScVal.scvSymbol(orderRef),
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
