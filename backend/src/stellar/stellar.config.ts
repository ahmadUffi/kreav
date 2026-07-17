/**
 * Typed Stellar integration config — loaded from env via NestJS ConfigService.
 *
 * Source: Kreav Backend PRD §15 (env vars) + ADR H1 (PLATFORM_WALLET_SECRET) +
 * Stellar Standards PRD §3 (USDC testnet addresses).
 *
 * All Stellar-specific mechanics live here so the services stay focused on logic.
 */

/** Injection token for the StellarConfig (it's an interface, not a class). */
export const STELLAR_CONFIG = Symbol('STELLAR_CONFIG');

/** Injection token for the public Stellar config — exported to other modules. */
export const STELLAR_PUBLIC_CONFIG = Symbol('STELLAR_PUBLIC_CONFIG');

export interface StellarConfig {
  /** Soroban RPC endpoint — primary for contract invoke/verify (ADR-005). */
  sorobanRpcUrl: string;
  /** Horizon endpoint — secondary, for balance/trustline reads (ADR-005). */
  horizonUrl: string;
  /** Platform account public key (G...) — the settlement invoker + float holder. */
  platformWalletAddress: string;
  /** Platform account secret key (S...) — the SOLE server-side secret (ADR H1/ED-10). */
  platformWalletSecret: string;
  /** USDC classic issuer (G...) — for trustline checks. */
  usdcIssuer: string;
  /** USDC asset code — "USDC". */
  usdcAssetCode: string;
  /** Deployed Revenue Split contract address (C...). */
  splitContractId: string;
  /** Stellar network passphrase — TESTNET for the demo. */
  networkPassphrase: string;
  /** Base URL for the Stellar block explorer (e.g. stellar.expert). BE-010. */
  explorerUrl: string;
  /** SEP-10 web-auth endpoint of the off-ramp anchor (Fase 2A). */
  anchorWebAuthUrl: string;
  /** SEP-24 transfer server of the off-ramp anchor (Fase 2A). */
  anchorTransferServerUrl: string;
  /** Anchor home domain — used as the SEP-10 client_domain / home_domain. */
  anchorHomeDomain: string;
  /** Feature flag: enable the real SEP-24 off-ramp path (else simulation). */
  anchorEnabled: boolean;
}

/** Public subset of StellarConfig — safe to export to other modules. */
export type StellarPublicConfig = Omit<StellarConfig, 'platformWalletSecret'>;

/** Default Stellar.expert explorer URL for testnet. */
export const EXPLORER_TESTNET_URL = 'https://stellar.expert/explorer/testnet';

/** Testnet constants from the Stellar Skills (agentic-payments skill). */
export const USDC_TESTNET_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

/** USDC uses 7 decimals on Stellar (ED-7). DB stores Decimal(18,2). */
export const USDC_DECIMALS = 7;

/**
 * SDF public SEP-24 test anchor — no approval / allowlist needed, and its USDC
 * issuer matches USDC_TESTNET_ISSUER, so a creator's settled USDC off-ramps with
 * no asset mismatch. Same SEP-10 + SEP-24 protocol as MoneyGram, so the
 * production swap is just changing these URLs. ROADMAP Fase 2A.
 */
export const ANCHOR_TESTNET_WEB_AUTH_URL = 'https://testanchor.stellar.org/auth';
export const ANCHOR_TESTNET_TRANSFER_SERVER_URL = 'https://testanchor.stellar.org/sep24';
export const ANCHOR_TESTNET_HOME_DOMAIN = 'testanchor.stellar.org';

/**
 * Build a StellarConfig from the ConfigService (env).
 * Warns (dev-safe) if a required var is missing — fail fast at boot (audit #6).
 */
export function loadStellarConfig(get: (key: string) => string | undefined): StellarConfig {
  const required = {
    sorobanRpcUrl: get('SOROBAN_RPC_URL'),
    horizonUrl: get('HORIZON_URL'),
    platformWalletAddress: get('PLATFORM_WALLET_ADDRESS'),
    platformWalletSecret: get('PLATFORM_WALLET_SECRET'),
    usdcIssuer: get('USDC_ISSUER'),
    usdcAssetCode: get('USDC_ASSET_CODE'),
    splitContractId: get('SPLIT_CONTRACT_ID'),
  } as Record<string, string | undefined>;

  // Optional: block explorer URL (BE-010). Falls back to stellar.expert testnet.
  const explorerUrl = get('EXPLORER_URL') ?? EXPLORER_TESTNET_URL;

  // Optional: off-ramp anchor (Fase 2A). Defaults to the SDF test anchor and is
  // OFF unless ANCHOR_ENABLED is explicitly truthy — so the simulated withdrawal
  // stays the default and nothing breaks if the anchor is down.
  const anchor = {
    anchorWebAuthUrl: get('ANCHOR_WEB_AUTH_URL') ?? ANCHOR_TESTNET_WEB_AUTH_URL,
    anchorTransferServerUrl:
      get('ANCHOR_TRANSFER_SERVER_URL') ?? ANCHOR_TESTNET_TRANSFER_SERVER_URL,
    anchorHomeDomain: get('ANCHOR_HOME_DOMAIN') ?? ANCHOR_TESTNET_HOME_DOMAIN,
    anchorEnabled: /^(1|true|yes)$/i.test(get('ANCHOR_ENABLED') ?? ''),
  };

  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    // Dev-safe: warn at boot rather than crash. The services fail clearly when
    // actually used (lazy keypair loading, RPC/Horizon will throw on bad URLs).
    // This lets the app start for product/order work without Stellar env set up.
    // Production MUST have all of these or settlement will fail at runtime.

    console.warn(
      `[Stellar] Config incomplete — missing: ${missing.join(', ')}. ` +
        'Non-settlement features work; settlement will fail until set. See docs/backend/Backend-PRD.md §15.',
    );
    return {
      sorobanRpcUrl: required.sorobanRpcUrl ?? '',
      horizonUrl: required.horizonUrl ?? '',
      platformWalletAddress: required.platformWalletAddress ?? '',
      platformWalletSecret: required.platformWalletSecret ?? '',
      usdcIssuer: required.usdcIssuer ?? USDC_TESTNET_ISSUER,
      usdcAssetCode: required.usdcAssetCode ?? 'USDC',
      splitContractId: required.splitContractId ?? '',
      networkPassphrase: STELLAR_TESTNET_PASSPHRASE,
      explorerUrl,
      ...anchor,
    } satisfies StellarConfig;
  }

  return {
    ...required,
    networkPassphrase: STELLAR_TESTNET_PASSPHRASE,
    explorerUrl,
    ...anchor,
  } as StellarConfig;
}

// The TESTNET passphrase is a constant (never changes). Hardcoded rather than
// imported from the SDK to avoid loading the ESM SDK in config-only contexts.
export const STELLAR_TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
