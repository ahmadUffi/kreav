import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';
import { AppEvents } from '../events/event-names';

/**
 * OrdersService unit tests — Prisma + EventEmitter mocked.
 *
 * Covers: checkout (product lookup → order creation → CHECKOUT_STARTED),
 * webhook happy path (→ PAYMENT_RECEIVED → emit payment.received),
 * idempotency (duplicate paymentRef ignored), WAITING_WALLET (no wallet),
 * invalid transitions.
 */
describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: {
    product: { findUnique: jest.Mock };
    order: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
    };
    wallet: { findFirst: jest.Mock };
  };
  let emitter: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      product: { findUnique: jest.fn() },
      order: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
      wallet: { findFirst: jest.fn() },
    };
    emitter = { emit: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();

    service = moduleRef.get(OrdersService);
  });

  describe('checkout', () => {
    it('creates an order at PAYMENT_PENDING with the product price', async () => {
      const product = { id: 'p1', priceUsd: new Prisma.Decimal('10.00'), creatorId: 'u1' };
      prisma.product.findUnique.mockResolvedValue(product);
      prisma.order.create.mockResolvedValue({ id: 'o1', status: OrderStatus.PAYMENT_PENDING });

      const result = await service.checkout('p1');

      const createData = prisma.order.create.mock.calls[0][0].data;
      expect(createData.productId).toBe('p1');
      expect(createData.buyerEmail).toEqual(expect.any(String));
      expect(createData.amountUsd.toFixed(2)).toBe('10.00'); // value match, not identity
      expect(createData.status).toBe(OrderStatus.PAYMENT_PENDING);
      expect(result).toEqual({ orderId: 'o1' });
    });

    it('throws NotFoundException when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.checkout('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('stores a fresh decimal copy (not the product reference)', async () => {
      const product = { id: 'p1', priceUsd: new Prisma.Decimal('10.00'), creatorId: 'u1' };
      prisma.product.findUnique.mockResolvedValue(product);
      prisma.order.create.mockResolvedValue({ id: 'o1' });

      await service.checkout('p1');
      const stored = prisma.order.create.mock.calls[0][0].data.amountUsd;
      expect(stored).not.toBe(product.priceUsd); // a NEW Decimal instance
      expect(stored.toFixed(2)).toBe('10.00');
    });
  });

  describe('handleGcashPayment (webhook)', () => {
    const orderId = 'o1';
    const paymentRef = 'gcash-tx-001';

    const mockOrder = (overrides: Partial<Record<string, unknown>> = {}) => ({
      id: orderId,
      status: OrderStatus.PAYMENT_PENDING,
      amountUsd: new Prisma.Decimal('10.00'),
      product: { creatorId: 'u-creator' },
      paymentRef: null,
      ...overrides,
    });

    it('moves order to PAYMENT_RECEIVED and emits payment.received', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder());
      prisma.wallet.findFirst.mockResolvedValue({ walletAddress: 'GCREATOR' });
      prisma.order.update.mockResolvedValue({
        ...mockOrder(),
        status: OrderStatus.PAYMENT_RECEIVED,
      });

      const result = await service.handleGcashPayment(orderId, paymentRef);

      expect(result).toEqual({ status: 'paid', orderId });
      expect(emitter.emit).toHaveBeenCalledWith(AppEvents.PaymentReceived, {
        orderId,
        amountUsd: '10.00',
        creatorId: 'u-creator',
        walletAddress: 'GCREATOR',
        paymentRef,
      });
    });

    it('is idempotent: duplicate paymentRef is ignored with no re-emit', async () => {
      // An order already has this paymentRef → it's a duplicate webhook.
      prisma.order.findFirst.mockResolvedValue({ id: 'some-order' });

      const result = await service.handleGcashPayment(orderId, paymentRef);

      expect(result).toEqual({ status: 'paid', orderId }); // still success
      expect(emitter.emit).not.toHaveBeenCalled();
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('routes to WAITING_WALLET and emits wallet.connect.required when no wallet', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder());
      prisma.wallet.findFirst.mockResolvedValue(null); // no wallet
      prisma.order.update.mockResolvedValue({ ...mockOrder(), status: OrderStatus.WAITING_WALLET });

      await service.handleGcashPayment(orderId, paymentRef);

      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: OrderStatus.WAITING_WALLET, paymentRef } }),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        AppEvents.WalletConnectRequired,
        expect.objectContaining({ orderId, creatorId: 'u-creator' }),
      );
      // must NOT emit payment.received in the deferral path
      expect(emitter.emit).not.toHaveBeenCalledWith(AppEvents.PaymentReceived, expect.anything());
    });

    it('throws NotFound when order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.handleGcashPayment('ghost', paymentRef)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
