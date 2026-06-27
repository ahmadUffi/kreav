import { loadStellarConfig, USDC_TESTNET_ISSUER, USDC_DECIMALS } from './stellar.config';

/**
 * StellarConfig — env loading + validation.
 * Dev-safe: warns (not throws) on missing env so the app boots for non-Stellar work.
 */
describe('loadStellarConfig', () => {
  const FULL_ENV = {
    SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
    HORIZON_URL: 'https://horizon-testnet.stellar.org',
    PLATFORM_WALLET_ADDRESS: 'GABC123',
    PLATFORM_WALLET_SECRET: 'SDEF456',
    USDC_ISSUER: 'GISSUER',
    USDC_ASSET_CODE: 'USDC',
    SPLIT_CONTRACT_ID: 'CCONTRACT',
  };

  it('returns a complete config when all env vars are present', () => {
    const config = loadStellarConfig((key) => FULL_ENV[key as keyof typeof FULL_ENV]);
    expect(config.sorobanRpcUrl).toBe(FULL_ENV.SOROBAN_RPC_URL);
    expect(config.platformWalletSecret).toBe('SDEF456');
    expect(config.splitContractId).toBe('CCONTRACT');
    expect(config.networkPassphrase).toContain('Test'); // TESTNET passphrase
  });

  it('warns (console.warn) but does NOT throw on missing env vars (dev-safe)', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const config = loadStellarConfig(() => undefined);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Config incomplete'));
    // Returns a usable-ish config with empty strings + defaults
    expect(config.sorobanRpcUrl).toBe('');
    expect(config.usdcAssetCode).toBe('USDC'); // default
    expect(config.usdcIssuer).toBe(USDC_TESTNET_ISSUER); // default
    warnSpy.mockRestore();
  });

  it('provides the canonical USDC testnet issuer + decimals constants', () => {
    expect(USDC_TESTNET_ISSUER).toMatch(/^G[A-Z0-9]{55}$/);
    expect(USDC_DECIMALS).toBe(7);
  });
});
