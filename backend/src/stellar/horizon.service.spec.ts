// Mock the stellar-sdk BEFORE importing the service — avoids ESM @noble/hashes
// loading issues in Jest (SDK v16 is ESM-first; Jest is CJS).
jest.mock('@stellar/stellar-sdk', () => ({
  Horizon: {
    Server: jest.fn().mockImplementation(() => ({
      loadAccount: jest.fn(),
    })),
  },
}));

import { Test } from '@nestjs/testing';
import { Horizon } from '@stellar/stellar-sdk';
import { HorizonService, type WalletBalanceResult } from './horizon.service';
import { STELLAR_CONFIG, type StellarConfig } from './stellar.config';

/**
 * HorizonService — balance + trustline reads (mocked Horizon.Server).
 */
describe('HorizonService', () => {
  let service: HorizonService;
  let loadAccountMock: jest.Mock;

  const mockConfig: StellarConfig = {
    sorobanRpcUrl: 'rpc',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    platformWalletAddress: 'GPLATFORM',
    platformWalletSecret: 'SPLATFORM',
    usdcIssuer: 'GISSUER',
    usdcAssetCode: 'USDC',
    splitContractId: 'CCONTRACT',
    networkPassphrase: 'Test SDF Network ; September 2015',
    explorerUrl: 'https://stellar.expert/explorer/testnet',
    anchorWebAuthUrl: 'https://testanchor.stellar.org/auth',
    anchorTransferServerUrl: 'https://testanchor.stellar.org/sep24',
    anchorHomeDomain: 'testanchor.stellar.org',
    anchorEnabled: false,
  };

  beforeEach(async () => {
    loadAccountMock = jest.fn();
    jest.mocked(Horizon.Server).mockReturnValue({
      loadAccount: loadAccountMock,
    } as unknown as InstanceType<typeof Horizon.Server>);

    const moduleRef = await Test.createTestingModule({
      providers: [HorizonService, { provide: STELLAR_CONFIG, useValue: mockConfig }],
    }).compile();
    service = moduleRef.get(HorizonService);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns the USDC balance + trustline=true when present', async () => {
    loadAccountMock.mockResolvedValue({
      balances: [
        { asset_type: 'native', balance: '100.0' },
        {
          asset_type: 'credit_alphanum4',
          asset_code: 'USDC',
          asset_issuer: 'GISSUER',
          balance: '9.50',
        },
      ],
    });

    const result: WalletBalanceResult = await service.getUsdcBalance('GWALLET');

    expect(result.balanceUsd).toBe('9.50');
    expect(result.hasUsdcTrustline).toBe(true);
    expect(result.accountExists).toBe(true);
  });

  it('returns balance "0" + trustline=false when account has no USDC', async () => {
    loadAccountMock.mockResolvedValue({
      balances: [{ asset_type: 'native', balance: '5.0' }],
    });

    const result = await service.getUsdcBalance('GWALLET');

    expect(result.balanceUsd).toBe('0');
    expect(result.hasUsdcTrustline).toBe(false);
    expect(result.accountExists).toBe(true);
  });

  it('returns accountExists=false when the account is not funded (404)', async () => {
    loadAccountMock.mockRejectedValue(
      Object.assign(new Error('Not Found'), { response: { status: 404 } }),
    );

    const result = await service.getUsdcBalance('GUNFUNDED');

    expect(result.accountExists).toBe(false);
    expect(result.balanceUsd).toBe('0');
    expect(result.hasUsdcTrustline).toBe(false);
  });

  it('propagates non-404 errors (network/timeout)', async () => {
    loadAccountMock.mockRejectedValue(new Error('Network error'));

    await expect(service.getUsdcBalance('GWALLET')).rejects.toThrow('Network error');
  });
});
