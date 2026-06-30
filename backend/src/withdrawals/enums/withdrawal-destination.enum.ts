/**
 * Supported withdrawal destinations for the mock Anchor off-ramp (BE-009).
 *
 * Covers popular e-wallets and banks in Southeast Asia (Indonesia & Philippines)
 * to match the demo characters: Indonesian creator, Philippine buyer.
 *
 * MVP: all destinations are SIMULATED — no real money moves.
 */
export enum WithdrawalDestination {
  // Philippines
  GCASH = 'GCASH',
  PAYMAYA = 'PAYMAYA',
  // Indonesia
  GOPAY = 'GOPAY',
  OVO = 'OVO',
  DANA = 'DANA',
  SHOPEEPAY = 'SHOPEEPAY',
  // Generic
  BANK = 'BANK',
}
