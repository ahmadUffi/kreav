import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderStatus, Prisma, SettlementStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppEvents } from '../events/event-names';
import type { PaymentReceivedPayload } from '../events/event-payloads';
import { SettlementService } from './settlement.service';
import {
  SorobanRpcService,
  SettlementSimulationError,
  SettlementSubmissionError,
  SettlementTimeoutError,
} from './soroban-rpc.service';
import { HorizonService } from './horizon.service';
import { STELLAR_CONFIG } from './stellar.config';
import { USDC_DECIMALS } from './stellar.config';

/**
 * SettlementService — test suite (BE-007).
 *
 * Tests assert the full settlement orchestration:
 *   payment.received → validate → invokeSettle → record → emit
 *
 * The SorobanRpcService is fully mocked so no Stellar network calls happen.
 */
describe('SettlementService', () => {
  let service: SettlementService;
  let prisma: {
    order: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    productCollaborator: {
      findMany: jest.Mock;
    };
    settlement: {
      create: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  let emitter: { emit: jest.Mock };
  let sorobanRpc: { invokeSettle: jest.Mock; isSettled: jest.Mock };
  let horizon: { getUsdcBalance: jest.Mock };

  // ── Test data ──────────────────────────────────────────────────────────────

  const PAYMENT_PAYLOAD: PaymentReceivedPayload = {
    orderId: 'order-abc-123',
    amountUsd: '10.00',
    creatorId: 'creator-uuid',
    walletAddress: 'GCREATOR123...',
    paymentRef: 'gcash-txn-001',
  };

  const MOCK_ORDER = {
    id: 'order-abc-123',
    status: 'PAYMENT_RECEIVED' as OrderStatus,
    productId: 'product-uuid',
    amountUsd: new Prisma.Decimal('10.00'),
    txHash: null as string | null,
  };

  const MOCK_COLLABORATORS = [
    {
      walletAddress: 'GCREATOR_A',
      role: 'Author',
      revenuePercentage: new Prisma.Decimal('70.00'),
    },
    {
      walletAddress: 'GCREATOR_B',
      role: 'Illustrator',
      revenuePercentage: new Prisma.Decimal('20.00'),
    },
    {
      walletAddress: 'GCREATOR_C',
      role: 'Editor',
      revenuePercentage: new Prisma.Decimal('10.00'),
    },
  ];

  const MOCK_INVOKE_SUCCESS = {
    txHash: 'abcdef1234567890',
    status: 'SUCCESS' as const,
    returnValue: undefined,
  };

  const MOCK_INVOKE_FAILED = {
    txHash: 'failedtxhash',
    status: 'FAILED' as const,
    errorResultXdr: 'AAAAAAAA...',
  };

  // ── Setup ──────────────────────────────────────────────────────────────────

  beforeEach(async () => {
    prisma = {
      order: { findUnique: jest.fn(), update: jest.fn() },
      productCollaborator: { findMany: jest.fn() },
      settlement: { create: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) },
    };
    emitter = { emit: jest.fn() };
    // Default: order not yet settled on-chain (pre-check passes through).
    sorobanRpc = { invokeSettle: jest.fn(), isSettled: jest.fn().mockResolvedValue(false) };
    // Default: every recipient already has a USDC trustline (pre-check passes).
    horizon = {
      getUsdcBalance: jest
        .fn()
        .mockResolvedValue({ balanceUsd: '100.00', hasUsdcTrustline: true, accountExists: true }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SettlementService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: emitter },
        { provide: SorobanRpcService, useValue: sorobanRpc },
        { provide: HorizonService, useValue: horizon },
        {
          provide: STELLAR_CONFIG,
          useValue: {
            platformWalletAddress: 'GPLATFORM...',
            platformWalletSecret: 'SPLATFORM...',
            sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
            horizonUrl: 'https://horizon-testnet.stellar.org',
            usdcIssuer: 'GBBD...',
            usdcAssetCode: 'USDC',
            splitContractId: 'CCONT...',
            networkPassphrase: 'Test SDF Network ; September 2015',
            explorerUrl: 'https://stellar.expert/explorer/testnet',
            anchorWebAuthUrl: '',
            anchorTransferServerUrl: '',
            anchorHomeDomain: '',
            anchorEnabled: false,
          },
        },
      ],
    }).compile();

    service = moduleRef.get(SettlementService);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('settles successfully: payment.received → SETTLED + Settlement rows + event', async () => {
    // Arrange: Order exists, collaborators sum to 100%, invoke succeeds.
    prisma.order.findUnique.mockResolvedValue(MOCK_ORDER);
    prisma.productCollaborator.findMany.mockResolvedValue(MOCK_COLLABORATORS);
    sorobanRpc.invokeSettle.mockResolvedValue(MOCK_INVOKE_SUCCESS);
    prisma.settlement.create.mockResolvedValue({ id: 'settlement-uuid' });

    // Act
    await service.handlePaymentReceived(PAYMENT_PAYLOAD);

    // Assert: Order transitioned to SETTLEMENT_PENDING first
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: PAYMENT_PAYLOAD.orderId },
      select: expect.any(Object),
    });

    // Assert: invokeSettle called with correct args
    // totalAmountBase = 10.00 × 10^7 = 100_000_000
    const expectedBaseAmount = BigInt(
      new Prisma.Decimal(PAYMENT_PAYLOAD.amountUsd).mul(10 ** USDC_DECIMALS).toFixed(0),
    );
    expect(sorobanRpc.invokeSettle).toHaveBeenCalledWith(
      PAYMENT_PAYLOAD.orderId,
      expectedBaseAmount,
      expect.arrayContaining([
        expect.objectContaining({ address: 'GCREATOR_A', shareBps: 7000 }),
        expect.objectContaining({ address: 'GCREATOR_B', shareBps: 2000 }),
        expect.objectContaining({ address: 'GCREATOR_C', shareBps: 1000 }),
      ]),
    );

    // Assert: Settlement created with correct data
    expect(prisma.settlement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: PAYMENT_PAYLOAD.orderId,
          status: SettlementStatus.COMPLETED,
          txHash: MOCK_INVOKE_SUCCESS.txHash,
        }),
      }),
    );

    // Assert: Order transitioned to SETTLED
    expect(prisma.order.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: PAYMENT_PAYLOAD.orderId },
        data: expect.objectContaining({ status: OrderStatus.SETTLED }),
      }),
    );

    // Assert: settlement.completed event emitted
    expect(emitter.emit).toHaveBeenCalledWith(
      AppEvents.SettlementCompleted,
      expect.objectContaining({
        orderId: PAYMENT_PAYLOAD.orderId,
        txHash: MOCK_INVOKE_SUCCESS.txHash,
        creatorAmountUsd: expect.any(String),
        platformAmountUsd: expect.any(String),
      }),
    );
  });

  // ── Collaborator validation ────────────────────────────────────────────────

  it('fails when collaborators sum is not 100%', async () => {
    prisma.order.findUnique.mockResolvedValue(MOCK_ORDER);
    prisma.productCollaborator.findMany.mockResolvedValue([
      {
        walletAddress: 'GCREATOR_A',
        role: 'Author',
        revenuePercentage: new Prisma.Decimal('50.00'),
      },
    ]);

    await service.handlePaymentReceived(PAYMENT_PAYLOAD);

    // Should NOT call inviteSettle
    expect(sorobanRpc.invokeSettle).not.toHaveBeenCalled();
    // Order should go to SETTLEMENT_FAILED
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: OrderStatus.SETTLEMENT_FAILED }),
      }),
    );
  });

  it('fails when there are no active collaborators', async () => {
    prisma.order.findUnique.mockResolvedValue(MOCK_ORDER);
    prisma.productCollaborator.findMany.mockResolvedValue([]);

    await service.handlePaymentReceived(PAYMENT_PAYLOAD);

    expect(sorobanRpc.invokeSettle).not.toHaveBeenCalled();
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: OrderStatus.SETTLEMENT_FAILED }),
      }),
    );
  });

  // ── Simulation error ───────────────────────────────────────────────────────

  it('fails to SETTLEMENT_FAILED when simulation fails', async () => {
    prisma.order.findUnique.mockResolvedValue(MOCK_ORDER);
    prisma.productCollaborator.findMany.mockResolvedValue(MOCK_COLLABORATORS);
    sorobanRpc.invokeSettle.mockRejectedValue(
      new SettlementSimulationError({ error: 'HostError: Error(ContractError)' }),
    );

    await service.handlePaymentReceived(PAYMENT_PAYLOAD);

    // Should have attempted the SETTLEMENT_PENDING transition, then failed
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: OrderStatus.SETTLEMENT_FAILED }),
      }),
    );
  });

  // ── On-chain FAILED ────────────────────────────────────────────────────────

  it('fails to SETTLEMENT_FAILED when on-chain transaction fails', async () => {
    prisma.order.findUnique.mockResolvedValue(MOCK_ORDER);
    prisma.productCollaborator.findMany.mockResolvedValue(MOCK_COLLABORATORS);
    sorobanRpc.invokeSettle.mockResolvedValue(MOCK_INVOKE_FAILED);

    await service.handlePaymentReceived(PAYMENT_PAYLOAD);

    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OrderStatus.SETTLEMENT_FAILED,
          txHash: MOCK_INVOKE_FAILED.txHash,
        }),
      }),
    );
  });

  // ── Submission error ───────────────────────────────────────────────────────

  it('fails to SETTLEMENT_FAILED when submission is rejected', async () => {
    prisma.order.findUnique.mockResolvedValue(MOCK_ORDER);
    prisma.productCollaborator.findMany.mockResolvedValue(MOCK_COLLABORATORS);
    sorobanRpc.invokeSettle.mockRejectedValue(new SettlementSubmissionError('tx-bad-seq'));

    await service.handlePaymentReceived(PAYMENT_PAYLOAD);

    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: OrderStatus.SETTLEMENT_FAILED }),
      }),
    );
  });

  // ── Poll timeout ───────────────────────────────────────────────────────────

  it('leaves order at SETTLEMENT_PENDING when poll times out', async () => {
    prisma.order.findUnique.mockResolvedValue(MOCK_ORDER);
    prisma.productCollaborator.findMany.mockResolvedValue(MOCK_COLLABORATORS);
    sorobanRpc.invokeSettle.mockRejectedValue(new SettlementTimeoutError('pending-tx-hash'));

    await service.handlePaymentReceived(PAYMENT_PAYLOAD);

    // Order should remain SETTLEMENT_PENDING — no status change on timeout
    // Only the initial transition to SETTLEMENT_PENDING should have been made
    const updateCalls = prisma.order.update.mock.calls.filter(
      (call) => call[0]?.data?.status === OrderStatus.SETTLEMENT_FAILED,
    );
    expect(updateCalls).toHaveLength(0);
  });

  // ── Decimal scaling ────────────────────────────────────────────────────────

  it('scales amount correctly: $10.00 → 100_000_000 base units', async () => {
    prisma.order.findUnique.mockResolvedValue(MOCK_ORDER);
    prisma.productCollaborator.findMany.mockResolvedValue([
      {
        walletAddress: 'GCREATOR_SOLO',
        role: 'Author',
        revenuePercentage: new Prisma.Decimal('100.00'),
      },
    ]);
    sorobanRpc.invokeSettle.mockResolvedValue(MOCK_INVOKE_SUCCESS);
    prisma.settlement.create.mockResolvedValue({ id: 'settlement-uuid' });

    await service.handlePaymentReceived(PAYMENT_PAYLOAD);

    expect(sorobanRpc.invokeSettle).toHaveBeenCalledWith(
      expect.any(String),
      BigInt(100_000_000), // $10.00 → 100_000_000 base units
      expect.any(Array),
    );
  });

  it('scales amount correctly: $0.50 → 5_000_000 base units', async () => {
    const smallPayload: PaymentReceivedPayload = {
      ...PAYMENT_PAYLOAD,
      amountUsd: '0.50',
    };

    prisma.order.findUnique.mockResolvedValue({
      ...MOCK_ORDER,
      amountUsd: new Prisma.Decimal('0.50'),
    });
    prisma.productCollaborator.findMany.mockResolvedValue([
      {
        walletAddress: 'GCREATOR_SOLO',
        role: 'Author',
        revenuePercentage: new Prisma.Decimal('100.00'),
      },
    ]);
    sorobanRpc.invokeSettle.mockResolvedValue(MOCK_INVOKE_SUCCESS);
    prisma.settlement.create.mockResolvedValue({ id: 'settlement-uuid' });

    await service.handlePaymentReceived(smallPayload);

    expect(sorobanRpc.invokeSettle).toHaveBeenCalledWith(
      expect.any(String),
      BigInt(5_000_000), // $0.50 → 5_000_000 base units
      expect.any(Array),
    );
  });

  // ── Settlement recipient amounts ───────────────────────────────────────────

  it('records correct recipient amounts in SettlementRecipient rows', async () => {
    prisma.order.findUnique.mockResolvedValue(MOCK_ORDER);
    prisma.productCollaborator.findMany.mockResolvedValue(MOCK_COLLABORATORS);
    sorobanRpc.invokeSettle.mockResolvedValue(MOCK_INVOKE_SUCCESS);

    let capturedSettlementData: any;
    prisma.settlement.create.mockImplementation((async (args: any) => {
      capturedSettlementData = args.data;
      return { id: 'settlement-uuid' };
    }) as any);

    await service.handlePaymentReceived(PAYMENT_PAYLOAD);

    // Verify SettlementRecipient rows were created
    const recipientRows = capturedSettlementData.recipients.create;
    expect(recipientRows).toHaveLength(4); // 1 platform + 3 creators

    // Platform row: 5% of $10.00 = $0.50
    const platformRow = recipientRows.find((r: any) => r.recipientType === 'PLATFORM');
    expect(platformRow).toBeDefined();
    expect(platformRow.amount.toNumber()).toBeCloseTo(0.5, 2);
    expect(platformRow.percentage.toNumber()).toBeCloseTo(5.0, 2);

    // Creator A: 70% of creator pool (9.50) = 6.65
    const creatorA = recipientRows.find((r: any) => r.walletAddress === 'GCREATOR_A');
    expect(creatorA).toBeDefined();
    expect(creatorA.amount.toNumber()).toBeCloseTo(6.65, 2);
    expect(creatorA.percentage.toNumber()).toBeCloseTo(70.0, 2);

    // Creator B: 20% of creator pool (9.50) = 1.90
    const creatorB = recipientRows.find((r: any) => r.walletAddress === 'GCREATOR_B');
    expect(creatorB).toBeDefined();
    expect(creatorB.amount.toNumber()).toBeCloseTo(1.9, 2);

    // Creator C: 10% of creator pool (9.50) = 0.95
    const creatorC = recipientRows.find((r: any) => r.walletAddress === 'GCREATOR_C');
    expect(creatorC).toBeDefined();
    expect(creatorC.amount.toNumber()).toBeCloseTo(0.95, 2);

    // Sum of all amounts should equal total
    const totalAmount = recipientRows.reduce((acc: number, r: any) => acc + r.amount.toNumber(), 0);
    expect(totalAmount).toBeCloseTo(10.0, 2);
  });

  // ── Event payload ──────────────────────────────────────────────────────────

  it('emits settlement.completed with correct payload', async () => {
    prisma.order.findUnique.mockResolvedValue(MOCK_ORDER);
    prisma.productCollaborator.findMany.mockResolvedValue(MOCK_COLLABORATORS);
    sorobanRpc.invokeSettle.mockResolvedValue(MOCK_INVOKE_SUCCESS);
    prisma.settlement.create.mockResolvedValue({ id: 'settlement-uuid' });

    await service.handlePaymentReceived(PAYMENT_PAYLOAD);

    expect(emitter.emit).toHaveBeenCalledWith(AppEvents.SettlementCompleted, {
      orderId: PAYMENT_PAYLOAD.orderId,
      txHash: MOCK_INVOKE_SUCCESS.txHash,
      creatorAmountUsd: '9.50', // 95% of $10
      platformAmountUsd: '0.50', // 5% of $10
    });
  });

  // ── On-chain idempotency pre-check (is_settled) ────────────────────────────

  it('recovers to SETTLED without re-invoking when order is already settled on-chain (row exists)', async () => {
    prisma.order.findUnique.mockResolvedValue(MOCK_ORDER);
    prisma.productCollaborator.findMany.mockResolvedValue(MOCK_COLLABORATORS);
    sorobanRpc.isSettled.mockResolvedValue(true);
    prisma.settlement.findUnique.mockResolvedValue({ id: 'settlement-uuid', txHash: 'prior-tx' });

    await service.handlePaymentReceived(PAYMENT_PAYLOAD);

    // Money already moved — must NOT invoke settle again.
    expect(sorobanRpc.invokeSettle).not.toHaveBeenCalled();
    expect(prisma.order.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: OrderStatus.SETTLED, txHash: 'prior-tx' }),
      }),
    );
  });

  it('records the settlement from the known txHash when already settled on-chain (no row yet)', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...MOCK_ORDER, txHash: 'crashed-tx-hash' });
    prisma.productCollaborator.findMany.mockResolvedValue(MOCK_COLLABORATORS);
    sorobanRpc.isSettled.mockResolvedValue(true);
    prisma.settlement.findUnique.mockResolvedValue(null);
    prisma.settlement.create.mockResolvedValue({ id: 'settlement-uuid' });

    await service.handlePaymentReceived(PAYMENT_PAYLOAD);

    expect(sorobanRpc.invokeSettle).not.toHaveBeenCalled();
    expect(prisma.settlement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ txHash: 'crashed-tx-hash' }),
      }),
    );
    expect(prisma.order.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: OrderStatus.SETTLED }),
      }),
    );
  });

  it('proceeds with the invoke when the is_settled pre-check itself errors', async () => {
    prisma.order.findUnique.mockResolvedValue(MOCK_ORDER);
    prisma.productCollaborator.findMany.mockResolvedValue(MOCK_COLLABORATORS);
    sorobanRpc.isSettled.mockRejectedValue(new Error('RPC unreachable'));
    sorobanRpc.invokeSettle.mockResolvedValue(MOCK_INVOKE_SUCCESS);
    prisma.settlement.create.mockResolvedValue({ id: 'settlement-uuid' });

    await service.handlePaymentReceived(PAYMENT_PAYLOAD);

    // Soft degrade: the contract's own guard is still authoritative.
    expect(sorobanRpc.invokeSettle).toHaveBeenCalled();
  });

  // ── MAX_RECIPIENTS guard (mirrors contract constant) ───────────────────────

  it('fails fast when there are more than 10 active collaborators', async () => {
    prisma.order.findUnique.mockResolvedValue(MOCK_ORDER);
    prisma.productCollaborator.findMany.mockResolvedValue(
      // 11 collaborators, shares still sum to 100.00 (10×9.09 + 9.10)
      Array.from({ length: 11 }, (_, i) => ({
        walletAddress: `GCREATOR_${i}`,
        role: 'Collaborator',
        revenuePercentage: new Prisma.Decimal(i === 10 ? '9.10' : '9.09'),
      })),
    );

    await service.handlePaymentReceived(PAYMENT_PAYLOAD);

    expect(sorobanRpc.invokeSettle).not.toHaveBeenCalled();
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: OrderStatus.SETTLEMENT_FAILED }),
      }),
    );
  });

  // ── Recipient trustline pre-check ──────────────────────────────────────────

  it('fails fast to SETTLEMENT_FAILED when a recipient lacks a USDC trustline', async () => {
    prisma.order.findUnique.mockResolvedValue(MOCK_ORDER);
    prisma.productCollaborator.findMany.mockResolvedValue(MOCK_COLLABORATORS);
    // GCREATOR_B has no trustline; the other two do.
    // Platform wallet returns high balance so the float check passes.
    horizon.getUsdcBalance.mockImplementation(async (address: string) => {
      if (address === 'GPLATFORM...')
        return { balanceUsd: '100.00', hasUsdcTrustline: true, accountExists: true };
      return {
        balanceUsd: '0',
        hasUsdcTrustline: address !== 'GCREATOR_B',
        accountExists: true,
      };
    });

    await service.handlePaymentReceived(PAYMENT_PAYLOAD);

    // Never invoke on-chain — would revert atomically and burn the fee.
    expect(sorobanRpc.invokeSettle).not.toHaveBeenCalled();
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: OrderStatus.SETTLEMENT_FAILED }),
      }),
    );
  });

  it('proceeds with settlement when a trustline read errors (soft degrade)', async () => {
    prisma.order.findUnique.mockResolvedValue(MOCK_ORDER);
    prisma.productCollaborator.findMany.mockResolvedValue(MOCK_COLLABORATORS);
    horizon.getUsdcBalance.mockRejectedValue(new Error('Horizon unreachable'));
    sorobanRpc.invokeSettle.mockResolvedValue(MOCK_INVOKE_SUCCESS);
    prisma.settlement.create.mockResolvedValue({ id: 'settlement-uuid' });

    await service.handlePaymentReceived(PAYMENT_PAYLOAD);

    // Contract remains the authoritative guard — do not block on a read failure.
    expect(sorobanRpc.invokeSettle).toHaveBeenCalled();
  });

  // ── Invalid state transition ───────────────────────────────────────────────

  it('does not attempt settlement when order is in terminal state', async () => {
    prisma.order.findUnique.mockResolvedValue({
      ...MOCK_ORDER,
      status: 'SETTLED' as OrderStatus,
    });

    await service.handlePaymentReceived(PAYMENT_PAYLOAD);

    // Should bail out before any DB writes or invoke
    expect(sorobanRpc.invokeSettle).not.toHaveBeenCalled();
    // Should not have tried to transition
    const pendingUpdate = prisma.order.update.mock.calls.find(
      (call) => (call[0] as any)?.data?.status === OrderStatus.SETTLEMENT_PENDING,
    );
    expect(pendingUpdate).toBeUndefined();
  });
});
