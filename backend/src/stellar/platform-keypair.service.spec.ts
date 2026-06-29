// Mock the stellar-sdk — Keypair.random() / fromSecret need crypto deps
// that don't play well with Jest's CJS environment (SDK v16 ESM).
jest.mock('@stellar/stellar-sdk', () => ({
  Keypair: {
    random: jest.fn(() => ({
      publicKey: () => 'GMOCKKEY000000000000000000000000000000000000000000000',
      secret: () => 'SMOCKSECRET000000000000000000000000000000000000000000000',
    })),
    fromSecret: jest.fn((s: string) => {
      if (!s || !s.startsWith('S')) throw new TypeError('invalid secret');
      return { publicKey: () => 'GMOCKKEY000000000000000000000000000000000000000000000' };
    }),
  },
}));

import { Test } from '@nestjs/testing';
import { PlatformKeypairService } from './platform-keypair.service';
import { STELLAR_CONFIG, type StellarConfig } from './stellar.config';

/**
 * PlatformKeypairService — lazy keypair loading from the platform secret.
 * The secret is never logged (only the first 8 chars of the public key).
 */
describe('PlatformKeypairService', () => {
  const validConfig: StellarConfig = {
    sorobanRpcUrl: 'rpc',
    horizonUrl: 'horizon',
    platformWalletAddress: 'GPLATFORM',
    platformWalletSecret: 'SVALIDSECRET',
    usdcIssuer: 'issuer',
    usdcAssetCode: 'USDC',
    splitContractId: 'contract',
    networkPassphrase: 'Test SDF Network ; September 2015',
  };

  async function makeService(secret: string | undefined): Promise<PlatformKeypairService> {
    const config = { ...validConfig, platformWalletSecret: secret };
    const moduleRef = await Test.createTestingModule({
      providers: [PlatformKeypairService, { provide: STELLAR_CONFIG, useValue: config }],
    }).compile();
    return moduleRef.get(PlatformKeypairService);
  }

  it('loads the keypair from the secret and caches it', async () => {
    const service = await makeService('SVALIDSECRET');
    const kp1 = service.getKeypair();
    const kp2 = service.getKeypair();
    expect(kp1.publicKey()).toMatch(/^G/);
    expect(kp2).toBe(kp1); // cached
  });

  it('getPublicKey returns the G... public key', async () => {
    const service = await makeService('SVALIDSECRET');
    expect(service.getPublicKey()).toMatch(/^G/);
  });

  it('throws if the secret is missing', async () => {
    const service = await makeService(undefined);
    expect(() => service.getKeypair()).toThrow('PLATFORM_WALLET_SECRET is not set');
  });

  it('throws if the secret is invalid', async () => {
    const service = await makeService('not-a-secret');
    expect(() => service.getKeypair()).toThrow('not a valid Stellar secret key');
  });
});
