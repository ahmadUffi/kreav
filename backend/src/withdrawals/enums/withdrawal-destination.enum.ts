/**
 * Supported withdrawal destinations for the mock Anchor off-ramp (BE-009).
 *
 * Covers popular e-wallets and banks across Southeast Asia.
 *
 * MVP: all destinations are SIMULATED — no real money moves.
 */
export enum WithdrawalDestination {
  // 🇵🇭 Philippines
  GCASH = 'GCASH',
  PAYMAYA = 'PAYMAYA',
  // 🇮🇩 Indonesia
  GOPAY = 'GOPAY',
  OVO = 'OVO',
  DANA = 'DANA',
  SHOPEEPAY = 'SHOPEEPAY',
  // 🇻🇳 Vietnam
  MOMO = 'MOMO',
  ZALOPAY = 'ZALOPAY',
  // 🇹🇭 Thailand
  TRUEMONEY = 'TRUEMONEY',
  PROMPTPAY = 'PROMPTPAY',
  // 🇲🇾 Malaysia
  TOUCHNGO = 'TOUCHNGO',
  GRABPAY = 'GRABPAY',
  // 🇸🇬 Singapore
  PAYNOW = 'PAYNOW',
  // 🇲🇲 Myanmar
  WAVEMONEY = 'WAVEMONEY',
  // 🇰🇭 Cambodia
  WING = 'WING',
  ABA = 'ABA',
  // 🌍 Generic
  BANK = 'BANK',
}
