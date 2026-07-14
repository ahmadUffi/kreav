/**
 * Supported withdrawal destinations for the mock Anchor off-ramp (BE-009).
 *
 * MVP covers the four primary payout rails used in the demo:
 *   - GCASH  (Philippines)
 *   - GOPAY  (Indonesia)
 *   - PAYNOW (Singapore)
 *   - BANK   (generic)
 *
 * MVP: all destinations are SIMULATED — no real money moves.
 */
export enum WithdrawalDestination {
  GCASH = 'GCASH',
  GOPAY = 'GOPAY',
  PAYNOW = 'PAYNOW',
  BANK = 'BANK',
}
