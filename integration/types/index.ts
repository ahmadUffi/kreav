/**
 * Shared type definitions for the Kreav integration workspace.
 */

import type { xdr } from '@stellar/stellar-sdk';

/** Stellar wallet public key (`G...`) or contract address (`C...`). */
export type StellarAddress = string;

/** Stellar secret key (`S...`). */
export type StellarSecret = string;

/** Transaction hash (hex). */
export type TransactionHash = string;

/** Amount in USDC base units (7 decimals as i128). */
export type BaseUnits = bigint;

/** A single recipient in a settlement. Ordered fields match the contract's Recipient struct. */
export interface Recipient {
  /** Creator wallet address (`G...`). */
  address: StellarAddress;
  /** Share of the creator pool in basis points (e.g. 5000 = 50%). Sum must be 10_000. */
  shareBps: number;
}

/** scVal representation of Recipient — used when building xdr arguments. */
export interface RecipientScVal {
  address: xdr.ScVal;
  shareBps: xdr.ScVal;
}

/** Result of a successful settle invocation. */
export interface SettleResult {
  /** On-chain transaction hash. */
  txHash: TransactionHash;
  /** Parsed SettlementExecuted event. */
  settlementEvent: SettlementExecutedEvent;
  /** Parsed RecipientPaid events — one per recipient. */
  recipientEvents: RecipientPaidEvent[];
}

/** Parsed SettlementExecuted contract event. */
export interface SettlementExecutedEvent {
  /** Total USDC settled (base units). */
  totalAmount: BaseUnits;
  /** Platform 5% fee retained (base units). */
  platformFeeAmount: BaseUnits;
  /** Creator pool distributed (base units). */
  creatorPoolAmount: BaseUnits;
  /** Number of recipients paid. */
  recipientCount: number;
}

/** Parsed RecipientPaid contract event. */
export interface RecipientPaidEvent {
  /** Creator wallet that received USDC. */
  address: StellarAddress;
  /** USDC amount received (base units). */
  amount: BaseUnits;
}

/** ContractError codes from the canonical Kreav settlement contract. */
export enum ContractErrorCode {
  AlreadyInitialized = 1,
  InvalidConfiguration = 2,
  NotInitialized = 3,
  UnauthorizedCaller = 4,
  OrderAlreadySettled = 5,
  InvalidTotalAmount = 6,
  EmptyRecipients = 7,
  TooManyRecipients = 8,
  InvalidRecipientAddress = 9,
  DuplicateRecipient = 10,
  ZeroAllocation = 11,
  InvalidAllocationSum = 12,
  ArithmeticOverflow = 13,
}

/** Network configuration. */
export interface NetworkConfig {
  /** Network name (`testnet`, `futurenet`, `pubnet`). */
  network: string;
  /** Soroban RPC endpoint URL. */
  rpcUrl: string;
  /** Stellar network passphrase for signing. */
  passphrase: string;
}

/** Wallet addresses for test scenarios. */
export interface WalletAddresses {
  platform: StellarAddress;
  creator: StellarAddress;
  photographer: StellarAddress;
  editor: StellarAddress;
}

/** Full resolved configuration. */
export interface AppConfig {
  network: NetworkConfig;
  contractId: StellarAddress;
  usdcSac: StellarAddress;
  platformSecret: StellarSecret;
  wallets: WalletAddresses;
}
