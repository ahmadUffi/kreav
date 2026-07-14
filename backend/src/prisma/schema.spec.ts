import { PrismaClient, OrderStatus, RecipientType } from '@prisma/client';

/**
 * Schema integrity test — verifies the Prisma client exposes all v3.1 models
 * and that the critical nested relations + enum members exist at the type level.
 * If this compiles + passes, the schema is wired correctly (BE-003).
 *
 * No DB writes — we only assert the client's shape, exercising the generated types.
 */
const prisma = new PrismaClient();

describe('Prisma schema (v3.1 core entities)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('all models are exposed on the client', () => {
    const models = [
      'user',
      'product',
      'productCollaborator',
      'order',
      'settlement',
      'settlementRecipient',
      'wallet',
      'withdrawal',
      'notificationLog',
    ] as const;

    it.each(models)('prisma.%s is defined', (model) => {
      expect(prisma[model]).toBeDefined();
      expect(typeof prisma[model].findMany).toBe('function');
    });
  });

  describe('nested relations are reachable (type-level)', () => {
    it('order → product → collaborators + creator', () => {
      // Compile-time check: if these nested includes don't exist in the schema,
      // TypeScript fails to compile this file.
      const query = prisma.order.findFirst({
        include: {
          product: { include: { collaborators: true, creator: true } },
          settlement: { include: { recipients: true, withdrawals: true } },
        },
      });
      expect(query).toBeDefined();
    });

    it('settlement → recipients + order + withdrawals', () => {
      const query = prisma.settlement.findFirst({
        include: {
          recipients: true,
          order: true,
          withdrawals: true,
        },
      });
      expect(query).toBeDefined();
    });

    it('user → products + wallets + withdrawals', () => {
      const query = prisma.user.findFirst({
        include: { products: true, wallets: true, withdrawals: true },
      });
      expect(query).toBeDefined();
    });
  });

  describe('enum members are present', () => {
    it('OrderStatus has all v3.1 lifecycle + failure states', () => {
      expect(OrderStatus.CREATED).toBe('CREATED');
      expect(OrderStatus.PAYMENT_RECEIVED).toBe('PAYMENT_RECEIVED');
      expect(OrderStatus.SETTLED).toBe('SETTLED');
      expect(OrderStatus.WITHDRAW_COMPLETED).toBe('WITHDRAW_COMPLETED');
      expect(OrderStatus.PAYMENT_FAILED).toBe('PAYMENT_FAILED');
      expect(OrderStatus.WAITING_WALLET).toBe('WAITING_WALLET');
      expect(OrderStatus.CANCELLED).toBe('CANCELLED');
    });

    it('RecipientType is extensible (CREATOR, PLATFORM, AFFILIATE, TREASURY)', () => {
      expect(Object.values(RecipientType)).toHaveLength(4);
    });
  });
});
