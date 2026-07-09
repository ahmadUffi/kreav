// Mock the stellar-sdk BEFORE importing the service (SDK v16 is ESM-first;
// Jest is CJS). We provide lean, shape-accurate fakes so the service's own
// logic — conflict guard, createAccount branching, anti-blind-sign validation —
// is exercised without real crypto or network.
let fromXdrReturn: unknown;

jest.mock('@stellar/stellar-sdk', () => {
  class Asset {
    constructor(
      public code: string,
      public issuer: string,
    ) {}
    getCode() {
      return this.code;
    }
    getIssuer() {
      return this.issuer;
    }
  }
  const Operation = {
    beginSponsoringFutureReserves: (o: any) => ({ type: 'beginSponsoringFutureReserves', ...o }),
    createAccount: (o: any) => ({ type: 'createAccount', ...o }),
    changeTrust: (o: any) => ({ type: 'changeTrust', line: o.asset, source: o.source }),
    endSponsoringFutureReserves: (o: any) => ({ type: 'endSponsoringFutureReserves', ...o }),
  };
  class TransactionBuilder {
    private ops: any[] = [];
    constructor(
      public source: any,
      public opts: any,
    ) {}
    addOperation(op: any) {
      this.ops.push(op);
      return this;
    }
    setTimeout() {
      return this;
    }
    build() {
      return {
        source: this.source.accountId?.() ?? this.source.accountId ?? 'GPLATFORM',
        operations: this.ops,
        signed: [] as string[],
        sign(kp: any) {
          this.signed.push(kp.publicKey());
        },
        toXDR() {
          return 'BUILT_XDR';
        },
      };
    }
    static fromXDR() {
      return fromXdrReturn;
    }
  }
  return {
    Asset,
    Operation,
    BASE_FEE: '100',
    TransactionBuilder,
    Transaction: class {},
    Horizon: {
      Server: jest.fn().mockImplementation(() => ({
        loadAccount: jest.fn(),
        submitTransaction: jest.fn(),
      })),
    },
  };
});

import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Horizon } from '@stellar/stellar-sdk';
import { SponsorshipService } from './sponsorship.service';
import { PlatformKeypairService } from './platform-keypair.service';
import { HorizonService } from './horizon.service';
import { STELLAR_CONFIG, type StellarConfig } from './stellar.config';

const PLATFORM = 'GPLATFORM';
const CREATOR = 'GCREATOR';

const mockConfig: StellarConfig = {
  sorobanRpcUrl: 'rpc',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  platformWalletAddress: PLATFORM,
  platformWalletSecret: 'SPLATFORM',
  usdcIssuer: 'GISSUER',
  usdcAssetCode: 'USDC',
  splitContractId: 'CCONTRACT',
  networkPassphrase: 'Test SDF Network ; September 2015',
  explorerUrl: 'https://stellar.expert/explorer/testnet',
};

/** Build a well-formed sponsored-trustline tx shape (what fromXDR would yield). */
function validSignedTx(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    source: PLATFORM,
    operations: [
      { type: 'beginSponsoringFutureReserves', sponsoredId: CREATOR },
      {
        type: 'changeTrust',
        line: { getCode: () => 'USDC', getIssuer: () => 'GISSUER' },
        source: CREATOR,
      },
      { type: 'endSponsoringFutureReserves', source: CREATOR },
    ],
    ...overrides,
  };
}

describe('SponsorshipService', () => {
  let service: SponsorshipService;
  let horizon: { getUsdcBalance: jest.Mock };
  let loadAccountMock: jest.Mock;
  let submitTransactionMock: jest.Mock;

  beforeEach(async () => {
    loadAccountMock = jest.fn().mockResolvedValue({ accountId: () => PLATFORM });
    submitTransactionMock = jest.fn().mockResolvedValue({ hash: 'TXHASH123' });
    jest.mocked(Horizon.Server).mockReturnValue({
      loadAccount: loadAccountMock,
      submitTransaction: submitTransactionMock,
    } as unknown as InstanceType<typeof Horizon.Server>);

    horizon = { getUsdcBalance: jest.fn() };
    const platformKey = {
      getKeypair: () => ({ publicKey: () => PLATFORM }),
      getPublicKey: () => PLATFORM,
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SponsorshipService,
        { provide: STELLAR_CONFIG, useValue: mockConfig },
        { provide: PlatformKeypairService, useValue: platformKey },
        { provide: HorizonService, useValue: horizon },
      ],
    }).compile();

    service = moduleRef.get(SponsorshipService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── prepare ────────────────────────────────────────────────────────────────

  it('rejects preparing a trustline that already exists', async () => {
    horizon.getUsdcBalance.mockResolvedValue({
      balanceUsd: '0',
      hasUsdcTrustline: true,
      accountExists: true,
    });

    await expect(service.prepareSponsoredTrustline(CREATOR)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('builds a 4-op tx (with createAccount) for an unfunded creator, platform-signed', async () => {
    horizon.getUsdcBalance.mockResolvedValue({
      balanceUsd: '0',
      hasUsdcTrustline: false,
      accountExists: false,
    });

    const result = await service.prepareSponsoredTrustline(CREATOR);

    expect(result.createsAccount).toBe(true);
    expect(result.networkPassphrase).toBe(mockConfig.networkPassphrase);
    expect(result.xdr).toBe('BUILT_XDR');
  });

  it('omits createAccount for a funded creator', async () => {
    horizon.getUsdcBalance.mockResolvedValue({
      balanceUsd: '0',
      hasUsdcTrustline: false,
      accountExists: true,
    });

    const result = await service.prepareSponsoredTrustline(CREATOR);

    expect(result.createsAccount).toBe(false);
  });

  // ── submit: anti blind-signing validation ────────────────────────────────────

  it('submits a valid creator-signed tx and returns the hash', async () => {
    fromXdrReturn = validSignedTx();
    const hash = await service.submitSponsoredTrustline('SIGNED', CREATOR);
    expect(hash).toBe('TXHASH123');
    expect(submitTransactionMock).toHaveBeenCalled();
  });

  it('rejects a tx whose source is not the platform', async () => {
    fromXdrReturn = validSignedTx({ source: 'GATTACKER' });
    await expect(service.submitSponsoredTrustline('SIGNED', CREATOR)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });

  it('rejects a tx sponsoring a different account than the caller', async () => {
    fromXdrReturn = validSignedTx({
      operations: [
        { type: 'beginSponsoringFutureReserves', sponsoredId: 'GSOMEONEELSE' },
        {
          type: 'changeTrust',
          line: { getCode: () => 'USDC', getIssuer: () => 'GISSUER' },
          source: 'GSOMEONEELSE',
        },
        { type: 'endSponsoringFutureReserves', source: 'GSOMEONEELSE' },
      ],
    });
    await expect(service.submitSponsoredTrustline('SIGNED', CREATOR)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a tx whose trustline asset is not the configured USDC', async () => {
    fromXdrReturn = validSignedTx({
      operations: [
        { type: 'beginSponsoringFutureReserves', sponsoredId: CREATOR },
        {
          type: 'changeTrust',
          line: { getCode: () => 'EVIL', getIssuer: () => 'GEVIL' },
          source: CREATOR,
        },
        { type: 'endSponsoringFutureReserves', source: CREATOR },
      ],
    });
    await expect(service.submitSponsoredTrustline('SIGNED', CREATOR)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a tx that is not a sponsorship at all', async () => {
    fromXdrReturn = validSignedTx({
      operations: [{ type: 'payment', destination: 'GATTACKER' }],
    });
    await expect(service.submitSponsoredTrustline('SIGNED', CREATOR)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
