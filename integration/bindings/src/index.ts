import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CBWMTV5SU7AXP5OWNKXJAQ6B3CH7J65UQVI35D3G55HMGF2JH4SQSWW6",
  }
} as const

/**
 * Typed storage keys — prevents key collisions between storage types.
 */
export type DataKey = {tag: "PlatformWallet", values: void} | {tag: "UsdcSac", values: void} | {tag: "Settlement", values: readonly [string]};


/**
 * A single recipient in a settlement.
 * 
 * The contract receives `share_bps` (NOT a pre-computed amount) so that
 * money-split logic lives in exactly one place — the contract.
 * The backend sends allocation percentages; the contract computes USDC amounts.
 * 
 * Whole creator_pool distribution is guaranteed: the last recipient absorbs
 * any integer-division rounding dust. Sum of all transfers ALWAYS equals
 * creator_pool, never less.
 */
export interface Recipient {
  /**
 * Stellar address of the creator (G... public key).
 */
address: string;
  /**
 * Share of the creator pool in basis points.
 * Must be > 0. Sum of all recipients' share_bps must equal 10_000 (100%).
 */
share_bps: i128;
}

/**
 * Contract errors with deterministic codes for backend mapping.
 * 
 * Every failure path returns a unique error code so the backend can
 * programmatically distinguish "order already settled" (idempotent → return
 * 200) from "invalid shares" (backend bug → alert) without parsing strings.
 * 
 * Note: `UnauthorizedCaller` (code 4) is defined for documentation and future
 * use but is not actively returned by the current implementation because
 * `require_auth()` failures are caught by the Soroban host at the
 * transaction-validation level, before contract code executes. The error
 * code is reserved for manual authorization checks in future versions.
 */
export const ContractError = {
  /**
   * `initialize` called more than once.
   */
  1: {message:"AlreadyInitialized"},
  /**
   * `initialize` called with platform_wallet == usdc_sac.
   */
  2: {message:"InvalidConfiguration"},
  /**
   * `settle` called before `initialize`.
   */
  3: {message:"NotInitialized"},
  /**
   * Transaction signer is not the registered platform wallet.
   * Reserved: currently enforced by host-level `require_auth()`, not by
   * this contract's code path.
   */
  4: {message:"UnauthorizedCaller"},
  /**
   * Duplicate `order_ref` — settlement already executed for this order.
   */
  5: {message:"OrderAlreadySettled"},
  /**
   * `total_amount` is zero or negative.
   */
  6: {message:"InvalidTotalAmount"},
  /**
   * `recipients` vector is empty.
   */
  7: {message:"EmptyRecipients"},
  /**
   * `recipients` exceeds `MAX_RECIPIENTS`.
   */
  8: {message:"TooManyRecipients"},
  /**
   * A recipient address is zero or otherwise invalid.
   */
  9: {message:"InvalidRecipientAddress"},
  /**
   * The same address appears more than once in recipients.
   */
  10: {message:"DuplicateRecipient"},
  /**
   * A recipient has `share_bps == 0` (inactive collaborator).
   */
  11: {message:"ZeroAllocation"},
  /**
   * Sum of all `share_bps` does not equal 10_000 (100%).
   */
  12: {message:"InvalidAllocationSum"},
  /**
   * Checked arithmetic overflow (amounts too large).
   */
  13: {message:"ArithmeticOverflow"}
}



export interface Client {
  /**
   * Construct and simulate a settle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Execute a settlement: split USDC and transfer to recipients.
   * 
   * This is the core function of the contract. It:
   * 1. Verifies the caller is the registered platform wallet.
   * 2. Rejects duplicate settlements (idempotency via `order_ref`).
   * 3. Validates all inputs (amounts, recipients, allocation sum).
   * 4. Calculates the split: 5% platform fee, 95% creator pool.
   * 5. Transfers creator-pool shares to each recipient via the USDC SAC.
   * 6. Records the settlement marker on-chain.
   * 7. Emits events for backend reconciliation.
   * 
   * # The platform fee (5%) is NOT transferred.
   * It remains in the platform wallet automatically because only the
   * creator pool is sent out. No self-transfer needed.
   * 
   * # Rounding
   * The last recipient receives `creator_pool - sum_of_previous_amounts`,
   * ensuring the entire creator pool is always distributed with zero loss.
   * Maximum rounding dust: (N-1) base units = $0.0000009 for N=10.
   * 
   * # Parameters
   * - `order_ref`: Backend `Order.id` (UUID). The canonical settlement
   * identifier and idempotency key. One order = one settleme
   */
  settle: ({order_ref, total_amount, recipients}: {order_ref: string, total_amount: i128, recipients: Array<Recipient>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initialize the contract exactly once after deployment.
   * 
   * Stores the platform wallet address and the USDC SAC address in instance
   * storage. These are read on every `settle` call — the backend never
   * passes them as parameters, eliminating an entire class of
   * misconfiguration bugs.
   * 
   * # Errors
   * - `AlreadyInitialized` if called more than once.
   * - `InvalidConfiguration` if `platform_wallet == usdc_sac`.
   */
  initialize: ({platform_wallet, usdc_sac}: {platform_wallet: string, usdc_sac: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a is_settled transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check whether an order has already been settled.
   * 
   * The backend calls this before submitting a new settlement transaction,
   * and before retrying a failed one. If `true`, the backend should NOT
   * invoke `settle` again — the order is already settled.
   */
  is_settled: ({order_ref}: {order_ref: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a get_version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return the contract version string for compatibility checks and
   * block explorer display. Not used for on-chain logic.
   */
  get_version: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAgAAAEVUeXBlZCBzdG9yYWdlIGtleXMg4oCUIHByZXZlbnRzIGtleSBjb2xsaXNpb25zIGJldHdlZW4gc3RvcmFnZSB0eXBlcy4AAAAAAAAAAAAAB0RhdGFLZXkAAAAAAwAAAAAAAAA7SW5zdGFuY2U6IHBsYXRmb3JtIHdhbGxldCBhZGRyZXNzIChzaWduZXIgKyBmZWUgcmVjaXBpZW50KS4AAAAADlBsYXRmb3JtV2FsbGV0AAAAAAAAAAAAOEluc3RhbmNlOiBVU0RDIFNBQyBjb250cmFjdCBhZGRyZXNzIChhbGxvd2xpc3RlZCB0b2tlbikuAAAAB1VzZGNTYWMAAAAAAQAAAHdQZXJzaXN0ZW50OiBzZXR0bGVtZW50IG1hcmtlciBrZXllZCBieSBvcmRlcl9yZWYuClZhbHVlIGlzIGBib29sYCAodHJ1ZSA9IHNldHRsZWQpLiBCYWNrZW5kIHVzZXMgaGFzKCkgZm9yIGlkZW1wb3RlbmN5LgAAAAAKU2V0dGxlbWVudAAAAAAAAQAAABA=",
        "AAAAAQAAAaNBIHNpbmdsZSByZWNpcGllbnQgaW4gYSBzZXR0bGVtZW50LgoKVGhlIGNvbnRyYWN0IHJlY2VpdmVzIGBzaGFyZV9icHNgIChOT1QgYSBwcmUtY29tcHV0ZWQgYW1vdW50KSBzbyB0aGF0Cm1vbmV5LXNwbGl0IGxvZ2ljIGxpdmVzIGluIGV4YWN0bHkgb25lIHBsYWNlIOKAlCB0aGUgY29udHJhY3QuClRoZSBiYWNrZW5kIHNlbmRzIGFsbG9jYXRpb24gcGVyY2VudGFnZXM7IHRoZSBjb250cmFjdCBjb21wdXRlcyBVU0RDIGFtb3VudHMuCgpXaG9sZSBjcmVhdG9yX3Bvb2wgZGlzdHJpYnV0aW9uIGlzIGd1YXJhbnRlZWQ6IHRoZSBsYXN0IHJlY2lwaWVudCBhYnNvcmJzCmFueSBpbnRlZ2VyLWRpdmlzaW9uIHJvdW5kaW5nIGR1c3QuIFN1bSBvZiBhbGwgdHJhbnNmZXJzIEFMV0FZUyBlcXVhbHMKY3JlYXRvcl9wb29sLCBuZXZlciBsZXNzLgAAAAAAAAAACVJlY2lwaWVudAAAAAAAAAIAAAAxU3RlbGxhciBhZGRyZXNzIG9mIHRoZSBjcmVhdG9yIChHLi4uIHB1YmxpYyBrZXkpLgAAAAAAAAdhZGRyZXNzAAAAABMAAAByU2hhcmUgb2YgdGhlIGNyZWF0b3IgcG9vbCBpbiBiYXNpcyBwb2ludHMuCk11c3QgYmUgPiAwLiBTdW0gb2YgYWxsIHJlY2lwaWVudHMnIHNoYXJlX2JwcyBtdXN0IGVxdWFsIDEwXzAwMCAoMTAwJSkuAAAAAAAJc2hhcmVfYnBzAAAAAAAACw==",
        "AAAABAAAAnhDb250cmFjdCBlcnJvcnMgd2l0aCBkZXRlcm1pbmlzdGljIGNvZGVzIGZvciBiYWNrZW5kIG1hcHBpbmcuCgpFdmVyeSBmYWlsdXJlIHBhdGggcmV0dXJucyBhIHVuaXF1ZSBlcnJvciBjb2RlIHNvIHRoZSBiYWNrZW5kIGNhbgpwcm9ncmFtbWF0aWNhbGx5IGRpc3Rpbmd1aXNoICJvcmRlciBhbHJlYWR5IHNldHRsZWQiIChpZGVtcG90ZW50IOKGkiByZXR1cm4KMjAwKSBmcm9tICJpbnZhbGlkIHNoYXJlcyIgKGJhY2tlbmQgYnVnIOKGkiBhbGVydCkgd2l0aG91dCBwYXJzaW5nIHN0cmluZ3MuCgpOb3RlOiBgVW5hdXRob3JpemVkQ2FsbGVyYCAoY29kZSA0KSBpcyBkZWZpbmVkIGZvciBkb2N1bWVudGF0aW9uIGFuZCBmdXR1cmUKdXNlIGJ1dCBpcyBub3QgYWN0aXZlbHkgcmV0dXJuZWQgYnkgdGhlIGN1cnJlbnQgaW1wbGVtZW50YXRpb24gYmVjYXVzZQpgcmVxdWlyZV9hdXRoKClgIGZhaWx1cmVzIGFyZSBjYXVnaHQgYnkgdGhlIFNvcm9iYW4gaG9zdCBhdCB0aGUKdHJhbnNhY3Rpb24tdmFsaWRhdGlvbiBsZXZlbCwgYmVmb3JlIGNvbnRyYWN0IGNvZGUgZXhlY3V0ZXMuIFRoZSBlcnJvcgpjb2RlIGlzIHJlc2VydmVkIGZvciBtYW51YWwgYXV0aG9yaXphdGlvbiBjaGVja3MgaW4gZnV0dXJlIHZlcnNpb25zLgAAAAAAAAANQ29udHJhY3RFcnJvcgAAAAAAAA0AAAAjYGluaXRpYWxpemVgIGNhbGxlZCBtb3JlIHRoYW4gb25jZS4AAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAQAAADVgaW5pdGlhbGl6ZWAgY2FsbGVkIHdpdGggcGxhdGZvcm1fd2FsbGV0ID09IHVzZGNfc2FjLgAAAAAAABRJbnZhbGlkQ29uZmlndXJhdGlvbgAAAAIAAAAkYHNldHRsZWAgY2FsbGVkIGJlZm9yZSBgaW5pdGlhbGl6ZWAuAAAADk5vdEluaXRpYWxpemVkAAAAAAADAAAAmFRyYW5zYWN0aW9uIHNpZ25lciBpcyBub3QgdGhlIHJlZ2lzdGVyZWQgcGxhdGZvcm0gd2FsbGV0LgpSZXNlcnZlZDogY3VycmVudGx5IGVuZm9yY2VkIGJ5IGhvc3QtbGV2ZWwgYHJlcXVpcmVfYXV0aCgpYCwgbm90IGJ5CnRoaXMgY29udHJhY3QncyBjb2RlIHBhdGguAAAAElVuYXV0aG9yaXplZENhbGxlcgAAAAAABAAAAEVEdXBsaWNhdGUgYG9yZGVyX3JlZmAg4oCUIHNldHRsZW1lbnQgYWxyZWFkeSBleGVjdXRlZCBmb3IgdGhpcyBvcmRlci4AAAAAAAATT3JkZXJBbHJlYWR5U2V0dGxlZAAAAAAFAAAAI2B0b3RhbF9hbW91bnRgIGlzIHplcm8gb3IgbmVnYXRpdmUuAAAAABJJbnZhbGlkVG90YWxBbW91bnQAAAAAAAYAAAAdYHJlY2lwaWVudHNgIHZlY3RvciBpcyBlbXB0eS4AAAAAAAAPRW1wdHlSZWNpcGllbnRzAAAAAAcAAAAmYHJlY2lwaWVudHNgIGV4Y2VlZHMgYE1BWF9SRUNJUElFTlRTYC4AAAAAABFUb29NYW55UmVjaXBpZW50cwAAAAAAAAgAAAAxQSByZWNpcGllbnQgYWRkcmVzcyBpcyB6ZXJvIG9yIG90aGVyd2lzZSBpbnZhbGlkLgAAAAAAABdJbnZhbGlkUmVjaXBpZW50QWRkcmVzcwAAAAAJAAAANlRoZSBzYW1lIGFkZHJlc3MgYXBwZWFycyBtb3JlIHRoYW4gb25jZSBpbiByZWNpcGllbnRzLgAAAAAAEkR1cGxpY2F0ZVJlY2lwaWVudAAAAAAACgAAADlBIHJlY2lwaWVudCBoYXMgYHNoYXJlX2JwcyA9PSAwYCAoaW5hY3RpdmUgY29sbGFib3JhdG9yKS4AAAAAAAAOWmVyb0FsbG9jYXRpb24AAAAAAAsAAAA0U3VtIG9mIGFsbCBgc2hhcmVfYnBzYCBkb2VzIG5vdCBlcXVhbCAxMF8wMDAgKDEwMCUpLgAAABRJbnZhbGlkQWxsb2NhdGlvblN1bQAAAAwAAAAwQ2hlY2tlZCBhcml0aG1ldGljIG92ZXJmbG93IChhbW91bnRzIHRvbyBsYXJnZSkuAAAAEkFyaXRobWV0aWNPdmVyZmxvdwAAAAAADQ==",
        "AAAABQAAAJFFbWl0dGVkIHBlciByZWNpcGllbnQgYWZ0ZXIgdGhlaXIgVVNEQyB0cmFuc2ZlciBzdWNjZWVkcy4KClRvcGljcyAoaW5kZXhhYmxlKTogZXZlbnRfa2luZCAoInJlY2lwaWVudCIpLCBvcmRlcl9yZWYgKFVVSUQpLgpEYXRhOiBhZGRyZXNzLCBhbW91bnQuAAAAAAAAAAAAAA1SZWNpcGllbnRQYWlkAAAAAAAAAQAAAA5yZWNpcGllbnRfcGFpZAAAAAAABAAAACpUb3BpYyAxOiBhbHdheXMgInJlY2lwaWVudCIgZm9yIGZpbHRlcmluZy4AAAAAAApldmVudF9raW5kAAAAAAARAAAAAAAAADhUb3BpYyAyOiBiYWNrZW5kIE9yZGVyLmlkIOKAlCBjb3JyZWxhdGVzIHdpdGggdGhlIG9yZGVyLgAAAAlvcmRlcl9yZWYAAAAAAAAQAAAAAAAAACJDcmVhdG9yIHdhbGxldCB0aGF0IHJlY2VpdmVkIFVTREMuAAAAAAAHYWRkcmVzcwAAAAATAAAAAAAAAC5VU0RDIGFtb3VudCByZWNlaXZlZCAoYmFzZSB1bml0cywgNyBkZWNpbWFscykuAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=",
        "AAAABQAAAMpFbWl0dGVkIG9uY2UgYWZ0ZXIgYWxsIHRyYW5zZmVycyBpbiBhIHNldHRsZW1lbnQgc3VjY2VlZC4KClRvcGljcyAoaW5kZXhhYmxlKTogZXZlbnRfa2luZCAoInNldHRsZW1lbnQiKSwgb3JkZXJfcmVmIChVVUlEKS4KRGF0YTogdG90YWxfYW1vdW50LCBwbGF0Zm9ybV9mZWVfYW1vdW50LCBjcmVhdG9yX3Bvb2xfYW1vdW50LCByZWNpcGllbnRfY291bnQuAAAAAAAAAAAAElNldHRsZW1lbnRFeGVjdXRlZAAAAAAAAQAAABNzZXR0bGVtZW50X2V4ZWN1dGVkAAAAAAYAAAArVG9waWMgMTogYWx3YXlzICJzZXR0bGVtZW50IiBmb3IgZmlsdGVyaW5nLgAAAAAKZXZlbnRfa2luZAAAAAAAEQAAAAAAAAA4VG9waWMgMjogYmFja2VuZCBPcmRlci5pZCDigJQgY29ycmVsYXRlcyB3aXRoIHRoZSBvcmRlci4AAAAJb3JkZXJfcmVmAAAAAAAAEAAAAAAAAAAsVG90YWwgVVNEQyBzZXR0bGVkIChiYXNlIHVuaXRzLCA3IGRlY2ltYWxzKS4AAAAMdG90YWxfYW1vdW50AAAACwAAAAAAAAA1UGxhdGZvcm0gZmVlIHJldGFpbmVkICg1JSwgc3RheXMgaW4gcGxhdGZvcm0gd2FsbGV0KS4AAAAAAAATcGxhdGZvcm1fZmVlX2Ftb3VudAAAAAALAAAAAAAAAC1DcmVhdG9yIHBvb2wgZGlzdHJpYnV0ZWQgdG8gcmVjaXBpZW50cyAoOTUlKS4AAAAAAAATY3JlYXRvcl9wb29sX2Ftb3VudAAAAAALAAAAAAAAABpOdW1iZXIgb2YgcmVjaXBpZW50cyBwYWlkLgAAAAAAD3JlY2lwaWVudF9jb3VudAAAAAAEAAAAAAAAAAI=",
        "AAAAAAAABABFeGVjdXRlIGEgc2V0dGxlbWVudDogc3BsaXQgVVNEQyBhbmQgdHJhbnNmZXIgdG8gcmVjaXBpZW50cy4KClRoaXMgaXMgdGhlIGNvcmUgZnVuY3Rpb24gb2YgdGhlIGNvbnRyYWN0LiBJdDoKMS4gVmVyaWZpZXMgdGhlIGNhbGxlciBpcyB0aGUgcmVnaXN0ZXJlZCBwbGF0Zm9ybSB3YWxsZXQuCjIuIFJlamVjdHMgZHVwbGljYXRlIHNldHRsZW1lbnRzIChpZGVtcG90ZW5jeSB2aWEgYG9yZGVyX3JlZmApLgozLiBWYWxpZGF0ZXMgYWxsIGlucHV0cyAoYW1vdW50cywgcmVjaXBpZW50cywgYWxsb2NhdGlvbiBzdW0pLgo0LiBDYWxjdWxhdGVzIHRoZSBzcGxpdDogNSUgcGxhdGZvcm0gZmVlLCA5NSUgY3JlYXRvciBwb29sLgo1LiBUcmFuc2ZlcnMgY3JlYXRvci1wb29sIHNoYXJlcyB0byBlYWNoIHJlY2lwaWVudCB2aWEgdGhlIFVTREMgU0FDLgo2LiBSZWNvcmRzIHRoZSBzZXR0bGVtZW50IG1hcmtlciBvbi1jaGFpbi4KNy4gRW1pdHMgZXZlbnRzIGZvciBiYWNrZW5kIHJlY29uY2lsaWF0aW9uLgoKIyBUaGUgcGxhdGZvcm0gZmVlICg1JSkgaXMgTk9UIHRyYW5zZmVycmVkLgpJdCByZW1haW5zIGluIHRoZSBwbGF0Zm9ybSB3YWxsZXQgYXV0b21hdGljYWxseSBiZWNhdXNlIG9ubHkgdGhlCmNyZWF0b3IgcG9vbCBpcyBzZW50IG91dC4gTm8gc2VsZi10cmFuc2ZlciBuZWVkZWQuCgojIFJvdW5kaW5nClRoZSBsYXN0IHJlY2lwaWVudCByZWNlaXZlcyBgY3JlYXRvcl9wb29sIC0gc3VtX29mX3ByZXZpb3VzX2Ftb3VudHNgLAplbnN1cmluZyB0aGUgZW50aXJlIGNyZWF0b3IgcG9vbCBpcyBhbHdheXMgZGlzdHJpYnV0ZWQgd2l0aCB6ZXJvIGxvc3MuCk1heGltdW0gcm91bmRpbmcgZHVzdDogKE4tMSkgYmFzZSB1bml0cyA9ICQwLjAwMDAwMDkgZm9yIE49MTAuCgojIFBhcmFtZXRlcnMKLSBgb3JkZXJfcmVmYDogQmFja2VuZCBgT3JkZXIuaWRgIChVVUlEKS4gVGhlIGNhbm9uaWNhbCBzZXR0bGVtZW50CmlkZW50aWZpZXIgYW5kIGlkZW1wb3RlbmN5IGtleS4gT25lIG9yZGVyID0gb25lIHNldHRsZW1lAAAABnNldHRsZQAAAAAAAwAAAAAAAAAJb3JkZXJfcmVmAAAAAAAAEAAAAAAAAAAMdG90YWxfYW1vdW50AAAACwAAAAAAAAAKcmVjaXBpZW50cwAAAAAD6gAAB9AAAAAJUmVjaXBpZW50AAAAAAAAAQAAA+kAAAACAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAAYtJbml0aWFsaXplIHRoZSBjb250cmFjdCBleGFjdGx5IG9uY2UgYWZ0ZXIgZGVwbG95bWVudC4KClN0b3JlcyB0aGUgcGxhdGZvcm0gd2FsbGV0IGFkZHJlc3MgYW5kIHRoZSBVU0RDIFNBQyBhZGRyZXNzIGluIGluc3RhbmNlCnN0b3JhZ2UuIFRoZXNlIGFyZSByZWFkIG9uIGV2ZXJ5IGBzZXR0bGVgIGNhbGwg4oCUIHRoZSBiYWNrZW5kIG5ldmVyCnBhc3NlcyB0aGVtIGFzIHBhcmFtZXRlcnMsIGVsaW1pbmF0aW5nIGFuIGVudGlyZSBjbGFzcyBvZgptaXNjb25maWd1cmF0aW9uIGJ1Z3MuCgojIEVycm9ycwotIGBBbHJlYWR5SW5pdGlhbGl6ZWRgIGlmIGNhbGxlZCBtb3JlIHRoYW4gb25jZS4KLSBgSW52YWxpZENvbmZpZ3VyYXRpb25gIGlmIGBwbGF0Zm9ybV93YWxsZXQgPT0gdXNkY19zYWNgLgAAAAAKaW5pdGlhbGl6ZQAAAAAAAgAAAAAAAAAPcGxhdGZvcm1fd2FsbGV0AAAAABMAAAAAAAAACHVzZGNfc2FjAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==",
        "AAAAAAAAAPRDaGVjayB3aGV0aGVyIGFuIG9yZGVyIGhhcyBhbHJlYWR5IGJlZW4gc2V0dGxlZC4KClRoZSBiYWNrZW5kIGNhbGxzIHRoaXMgYmVmb3JlIHN1Ym1pdHRpbmcgYSBuZXcgc2V0dGxlbWVudCB0cmFuc2FjdGlvbiwKYW5kIGJlZm9yZSByZXRyeWluZyBhIGZhaWxlZCBvbmUuIElmIGB0cnVlYCwgdGhlIGJhY2tlbmQgc2hvdWxkIE5PVAppbnZva2UgYHNldHRsZWAgYWdhaW4g4oCUIHRoZSBvcmRlciBpcyBhbHJlYWR5IHNldHRsZWQuAAAACmlzX3NldHRsZWQAAAAAAAEAAAAAAAAACW9yZGVyX3JlZgAAAAAAABAAAAABAAAAAQ==",
        "AAAAAAAAAHRSZXR1cm4gdGhlIGNvbnRyYWN0IHZlcnNpb24gc3RyaW5nIGZvciBjb21wYXRpYmlsaXR5IGNoZWNrcyBhbmQKYmxvY2sgZXhwbG9yZXIgZGlzcGxheS4gTm90IHVzZWQgZm9yIG9uLWNoYWluIGxvZ2ljLgAAAAtnZXRfdmVyc2lvbgAAAAAAAAAAAQAAABA=" ]),
      options
    )
  }
  public readonly fromJSON = {
    settle: this.txFromJSON<Result<void>>,
        initialize: this.txFromJSON<Result<void>>,
        is_settled: this.txFromJSON<boolean>,
        get_version: this.txFromJSON<string>
  }
}