/**
 * USDC formatting and parsing utilities.
 *
 * USDC on Stellar uses 7 decimals (not 6 like EVM).
 * All on-chain amounts are i128 base units (bigint).
 *
 * @see docs/stellar/Stellar-Standards-PRD.md §3 (ED-7)
 */

import type { BaseUnits } from '../types/index.js';

/** USDC decimal places on Stellar. */
export const USDC_DECIMALS = 7;

/** 10^7 — converts base units to whole USDC. */
export const USDC_DIVISOR = 10_000_000n;

/**
 * Format raw base units as a USDC string (7 decimals).
 *
 * @example formatUsdc(100_000_000n) → "10.0000000"
 * @example formatUsdc(5_000_000n)   → "0.5000000"
 */
export function formatUsdc(raw: BaseUnits): string {
  const sign = raw < 0n ? '-' : '';
  const abs = raw < 0n ? -raw : raw;
  const whole = abs / USDC_DIVISOR;
  const frac = abs % USDC_DIVISOR;
  return `${sign}${whole.toString()}.${frac.toString().padStart(USDC_DECIMALS, '0')}`;
}

/**
 * Parse a USD string to base units.
 *
 * @example parseUsdc("10.00")   → 100_000_000n
 * @example parseUsdc("0.50")    → 5_000_000n
 * @example parseUsdc("9.50")    → 95_000_000n
 */
export function parseUsdc(usd: string): BaseUnits {
  const [whole = '0', frac = '0'] = usd.split('.');
  const paddedFrac = frac.padEnd(USDC_DECIMALS, '0').slice(0, USDC_DECIMALS);
  return BigInt(whole) * USDC_DIVISOR + BigInt(paddedFrac);
}

/**
 * Format a labelled value for table output.
 *
 * @example labelUsdc("Platform", 5_000_000n) → "Platform    0.5000000 USDC"
 */
export function labelUsdc(label: string, raw: BaseUnits): string {
  return `${label.padEnd(16)} ${formatUsdc(raw).padStart(11)} USDC`;
}

/**
 * Format a delta (before/after) line.
 *
 * @example deltaUsdc("Creator", 0n, 95_000_000n) → "Creator       0.0000000 → 9.5000000  (+9.5000000)"
 */
export function deltaUsdc(label: string, before: BaseUnits, after: BaseUnits): string {
  const delta = after - before;
  const sign = delta >= 0n ? '+' : '';
  return `${label.padEnd(16)} ${formatUsdc(before)} → ${formatUsdc(after)}  (${sign}${formatUsdc(delta)})`;
}

/**
 * Convert a Decimal(5,2) percentage to basis points.
 *   e.g. 70.50 → 7050
 */
export function pctToBps(pct: number): number {
  return Math.round(pct * 100);
}

/**
 * Format basis points as a human-readable percentage string.
 *   e.g. 5000 → "50.00%"
 */
export function bpsToPct(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}
