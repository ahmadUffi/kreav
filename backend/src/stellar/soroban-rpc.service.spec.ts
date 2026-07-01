// Mock the stellar-sdk BEFORE any imports — avoids ESM @noble/hashes loading
// issues in Jest (SDK v16 is ESM-first; Jest is CJS).
const mockRpcServer = {
  getAccount: jest.fn(),
  simulateTransaction: jest.fn(),
  sendTransaction: jest.fn(),
  getTransaction: jest.fn(),
};

jest.mock('@stellar/stellar-sdk', () => ({
  Address: jest.fn().mockImplementation((addr: string) => ({ toScVal: () => ({ addr }) })),
  BASE_FEE: '100',
  Contract: jest.fn().mockImplementation(() => ({ call: jest.fn(() => ({})) })),
  nativeToScVal: jest.fn(() => ({})),
  rpc: {
    Server: jest.fn(() => mockRpcServer),
    Api: { isSimulationError: jest.fn() },
    assembleTransaction: jest.fn(() => ({ build: () => ({ sign: jest.fn() }) })),
  },
  TransactionBuilder: jest.fn().mockImplementation(() => ({
    addOperation: jest.fn().mockReturnThis(),
    setTimeout: jest.fn().mockReturnThis(),
    build: jest.fn(() => ({ sign: jest.fn() })),
  })),
  xdr: {
    ScVal: {
      scvMap: jest.fn(() => ({})),
      scvVec: jest.fn(() => ({})),
      scvSymbol: jest.fn(() => ({})),
      scvString: jest.fn(() => ({})),
      scvU32: jest.fn(() => ({})),
    },
    ScMapEntry: jest.fn(),
    Int128Parts: jest.fn(),
  },
}));

import { Test } from '@nestjs/testing';
import { rpc } from '@stellar/stellar-sdk';
import {
  SorobanRpcService,
  SettlementSimulationError,
  SettlementTimeoutError,
} from './soroban-rpc.service';
import { PlatformKeypairService } from './platform-keypair.service';
import { STELLAR_CONFIG, type StellarConfig } from './stellar.config';

/**
 * SorobanRpcService — the canonical invoke pattern (mocked rpc.Server).
 *
 * Asserts the MANDATORY flow: build → simulate → assemble → sign → submit → poll.
 * Never submits a raw unsimulated invoke; retries verify, not re-invoke.
 */
describe('SorobanRpcService', () => {
  let service: SorobanRpcService;
  let platformKeyGetMock: jest.Mock;

  const mockConfig: StellarConfig = {
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    horizonUrl: 'horizon',
    platformWalletAddress: 'GPLATFORM',
    platformWalletSecret: 'SPLATFORM',
    usdcIssuer: 'GISSUER',
    usdcAssetCode: 'USDC',
    splitContractId: 'CCONTRACT',
    networkPassphrase: 'Test SDF Network ; September 2015',
    explorerUrl: 'https://stellar.expert/explorer/testnet',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    platformKeyGetMock = jest
      .fn()
      .mockReturnValue({ publicKey: () => 'GPLATFORM', sign: jest.fn() });

    const moduleRef = await Test.createTestingModule({
      providers: [
        SorobanRpcService,
        { provide: STELLAR_CONFIG, useValue: mockConfig },
        {
          provide: PlatformKeypairService,
          useValue: { getKeypair: platformKeyGetMock, getPublicKey: () => 'GPLATFORM' },
        },
      ],
    }).compile();
    service = moduleRef.get(SorobanRpcService);
  });

  const mockRecipients = [{ address: 'GCREATOR', shareBps: 9500 }];

  it('throws SettlementSimulationError when simulation fails', async () => {
    jest.mocked(rpc.Api.isSimulationError).mockReturnValue(true);
    mockRpcServer.simulateTransaction.mockResolvedValue({ error: 'panic' });

    await expect(
      service.invokeSettle('order-1', BigInt(100000000), mockRecipients),
    ).rejects.toBeInstanceOf(SettlementSimulationError);
  });

  it('returns SUCCESS with txHash + returnValue when the tx confirms', async () => {
    jest.mocked(rpc.Api.isSimulationError).mockReturnValue(false);
    mockRpcServer.simulateTransaction.mockResolvedValue({ result: {} });
    mockRpcServer.sendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'abc123' });
    mockRpcServer.getTransaction
      .mockResolvedValueOnce({ status: 'NOT_FOUND' })
      .mockResolvedValueOnce({ status: 'SUCCESS', returnValue: 'mock-return' });

    const result = await service.invokeSettle('order-1', BigInt(100000000), mockRecipients);

    expect(result.status).toBe('SUCCESS');
    expect(result.txHash).toBe('abc123');
    expect(result.returnValue).toBe('mock-return');
    expect(mockRpcServer.simulateTransaction).toHaveBeenCalledTimes(1);
    expect(mockRpcServer.sendTransaction).toHaveBeenCalledTimes(1);
    expect(mockRpcServer.getTransaction).toHaveBeenCalledTimes(2);
  });

  it('returns FAILED when the tx reverts on-chain', async () => {
    jest.mocked(rpc.Api.isSimulationError).mockReturnValue(false);
    mockRpcServer.simulateTransaction.mockResolvedValue({ result: {} });
    mockRpcServer.sendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'abc456' });
    mockRpcServer.getTransaction.mockResolvedValue({
      status: 'FAILED',
      resultXdr: { toXDR: () => 'error-xdr' },
    });

    const result = await service.invokeSettle('order-2', BigInt(100000000), mockRecipients);

    expect(result.status).toBe('FAILED');
    expect(result.txHash).toBe('abc456');
    expect(result.errorResultXdr).toBe('error-xdr');
  });

  it('throws SettlementTimeoutError when the tx is still NOT_FOUND after polling', async () => {
    jest.mocked(rpc.Api.isSimulationError).mockReturnValue(false);
    mockRpcServer.simulateTransaction.mockResolvedValue({ result: {} });
    mockRpcServer.sendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'abc789' });
    mockRpcServer.getTransaction.mockResolvedValue({ status: 'NOT_FOUND' });

    // Spy on setTimeout to make the poll loop instant (no 30s wait).
    jest.spyOn(global, 'setTimeout').mockImplementation((cb: TimerHandler) => {
      if (typeof cb === 'function') cb();
      return {} as NodeJS.Timeout;
    });

    await expect(
      service.invokeSettle('order-3', BigInt(100000000), mockRecipients),
    ).rejects.toBeInstanceOf(SettlementTimeoutError);

    jest.restoreAllMocks();
  }, 15_000);
});
