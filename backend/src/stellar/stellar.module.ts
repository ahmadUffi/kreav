/**
 * Stellar Module — PRD Sections 6, 11. Internal service only (no public endpoint).
 *
 * Will hold:
 *   - stellar.service.ts  (shared Stellar concerns)
 *   - horizon.service.ts  (query account/balance/transactions; verify tx by hash)
 *   - soroban.service.ts  (invoke revenue-split contract)
 *   - dto/                (Stellar-related DTOs)
 *
 * Stub only in BE-001; implemented in BE-007 (Settlement) and reused by BE-008/009.
 */
export class StellarModule {}
