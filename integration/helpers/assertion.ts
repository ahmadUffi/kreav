/**
 * Reusable assertions for integration tests.
 *
 * Every assertion function exits with a clear pass/fail result,
 * making tests self-documenting and easy to debug.
 */

import type { BaseUnits } from '../types/index.js';
import type { Logger } from './logger.js';

/** Platform fee: 500 bps = 5.00%. */
export const PLATFORM_FEE_BPS = 500;

/** Basis points denominator: 10_000 = 100%. */
export const BPS_DENOMINATOR = 10_000;

// ─────────────────────────────────────────────────────────────────────────────
// Money math (mirrors the contract's integer-division algorithms)
// ─────────────────────────────────────────────────────────────────────────────

/** Compute the platform fee in base units: totalAmount × 500 / 10000 */
export function platformFeeAmount(totalAmount: BaseUnits): BaseUnits {
  return (totalAmount * BigInt(PLATFORM_FEE_BPS)) / BigInt(BPS_DENOMINATOR);
}

/** Compute the creator pool in base units: totalAmount − platformFee */
export function creatorPoolAmount(totalAmount: BaseUnits): BaseUnits {
  return totalAmount - platformFeeAmount(totalAmount);
}

/**
 * Compute a single recipient's amount using the same integer-division formula
 * as the contract. Note: the LAST recipient absorbs rounding dust for exact
 * distribution — this function computes the pre-dust value.
 */
export function recipientShareAmount(
  creatorPool: BaseUnits,
  shareBps: number,
): BaseUnits {
  return (creatorPool * BigInt(shareBps)) / BigInt(BPS_DENOMINATOR);
}

/**
 * Compute the last recipient's amount (absorbs rounding dust).
 * Guarantees Σ amounts = creatorPool exactly.
 */
export function lastRecipientAmount(
  creatorPool: BaseUnits,
  previousAmounts: BaseUnits[],
): BaseUnits {
  const distributed = previousAmounts.reduce((sum, a) => sum + a, 0n);
  return creatorPool - distributed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Assertion helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assert that the actual amount matches the expected amount within an
 * acceptable tolerance (1 base unit for integer-division rounding).
 */
export function assertAmountEquals(
  log: Logger,
  label: string,
  actual: BaseUnits,
  expected: BaseUnits,
  tolerance: BaseUnits = 1n,
): boolean {
  const diff = actual >= expected ? actual - expected : expected - actual;
  if (diff <= tolerance) {
    log.pass(`${label}: ${actual} (expected ${expected})`);
    return true;
  }
  log.fail(`${label}: ${actual} !== ${expected} (diff=${diff})`);
  return false;
}

/**
 * Assert that a condition is true. Logs pass/fail.
 */
export function assertTrue(
  log: Logger,
  label: string,
  condition: boolean,
): boolean {
  if (condition) {
    log.pass(label);
    return true;
  }
  log.fail(label);
  return false;
}
