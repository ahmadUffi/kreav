import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DecimalToStringInterceptor } from '../src/common/serialization/decimal-to-string.interceptor';

/**
 * Wallet endpoints e2e — exercises GET /wallet/balance and
 * GET /wallet/transactions against a real Postgres.
 *
 * Balance is delegated to HorizonService (mocked via test setup —
 * the Horizon URL is typically empty in test env, so balance tests
 * will verify validation and error handling).
 *
 * Transactions query the SettlementRecipient table.
 *
 * Requires a running Postgres (docker compose up -d kreav-db) + migrations.
 */
describe('WalletsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // A valid Stellar public key for testing (G... format).
  const WALLET_ADDRESS = 'GDA2SQ2PHWIER57TDXKLBSOD3IT4GTAHK5RV2H27LJZAXDBWQ6KYJ72B';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(new DecimalToStringInterceptor());
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /wallet/balance', () => {
    it('400 — rejects an invalid address format', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/balance')
        .query({ address: 'not-a-stellar-address' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects an address with wrong prefix', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/balance')
        .query({ address: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects a short address', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/balance')
        .query({ address: 'GSHORT' });

      expect(res.status).toBe(400);
    });

    it('400 — requires address parameter', async () => {
      const res = await request(app.getHttpServer()).get('/wallet/balance');

      expect(res.status).toBe(400);
    });

    it('200 — accepts a valid Stellar address (may return error from Horizon)', async () => {
      // With an empty/unconfigured Horizon URL, the call will fail internally,
      // but the VALIDATION should pass (200 range is for validation; Horizon
      // error is a 5xx from the downstream call, not a 400).
      const res = await request(app.getHttpServer())
        .get('/wallet/balance')
        .query({ address: WALLET_ADDRESS });

      // If Horizon is configured, it could succeed; if not, it's a 500 from the
      // downstream error. Assert that validation passes (not 400).
      expect(res.status).not.toBe(400);
    });
  });

  describe('GET /wallet/transactions', () => {
    it('400 — rejects an invalid address format', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/transactions')
        .query({ address: 'bad-address' });

      expect(res.status).toBe(400);
    });

    it('400 — requires address parameter', async () => {
      const res = await request(app.getHttpServer()).get('/wallet/transactions');

      expect(res.status).toBe(400);
    });

    it('200 — returns empty transactions for address with no history', async () => {
      // Use a unique address that is guaranteed to have no data.
      const uniqueAddress = 'GBVHJ7YZ7TZKWW47CDN6LTIHBCUX4M5EELYJKBGMCNNTW4PM55ZZ7VZY';

      const res = await request(app.getHttpServer())
        .get('/wallet/transactions')
        .query({ address: uniqueAddress });

      expect(res.status).toBe(200);
      expect(res.body.address).toBe(uniqueAddress);
      expect(res.body.transactions).toEqual([]);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
      expect(res.body.total).toBe(0);
    });

    it('200 — returns transactions for an address with settlement history', async () => {
      // Create test data: a user, product, order, settlement, and recipient.
      const creator = await prisma.user.create({
        data: {
          email: `wallet-e2e+${Date.now()}@kreav.test`,
          name: 'Wallet E2E Creator',
          role: 'CREATOR',
        },
      });

      const product = await prisma.product.create({
        data: {
          title: 'Test Product',
          priceUsd: '10.00',
          creatorId: creator.id,
        },
      });

      const order = await prisma.order.create({
        data: {
          productId: product.id,
          buyerEmail: 'buyer@test.com',
          amountUsd: '10.00',
          status: 'SETTLED',
          txHash: 'e2e-test-tx-hash-1234567890abcdef',
          paymentRef: `wallet-e2e-ref-${Date.now()}`,
        },
      });

      // Create settlement + recipient for the wallet address
      const settlement = await prisma.settlement.create({
        data: {
          orderId: order.id,
          totalAmount: '10.00',
          txHash: order.txHash!,
          status: 'COMPLETED',
        },
      });

      await prisma.settlementRecipient.create({
        data: {
          settlementId: settlement.id,
          walletAddress: WALLET_ADDRESS,
          recipientType: 'CREATOR',
          role: 'Author',
          percentage: '95.00',
          amount: '9.50',
        },
      });

      // Query transactions
      const res = await request(app.getHttpServer())
        .get('/wallet/transactions')
        .query({ address: WALLET_ADDRESS });

      expect(res.status).toBe(200);
      expect(res.body.address).toBe(WALLET_ADDRESS);
      expect(res.body.transactions.length).toBeGreaterThanOrEqual(1);

      const tx = res.body.transactions.find((t: any) => t.orderId === order.id);
      expect(tx).toBeDefined();
      expect(tx.amount).toBe('9.50');
      expect(tx.totalAmount).toBe('10.00');
      expect(tx.recipientType).toBe('CREATOR');
      expect(tx.role).toBe('Author');
      expect(tx.percentage).toBe('95.00');
      expect(tx.txHash).toBe(order.txHash);
      expect(tx.status).toBe('COMPLETED');

      // Cleanup
      await prisma.settlementRecipient.deleteMany({
        where: { settlementId: settlement.id },
      });
      await prisma.settlement.delete({ where: { id: settlement.id } });
      await prisma.order.delete({ where: { id: order.id } });
      await prisma.product.delete({ where: { id: product.id } });
      await prisma.user.delete({ where: { id: creator.id } });
    });

    it('200 — respects pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/transactions')
        .query({ address: WALLET_ADDRESS, page: 2, limit: 5 });

      expect(res.status).toBe(200);
      expect(res.body.page).toBe(2);
      expect(res.body.limit).toBe(5);
    });

    it('400 — rejects invalid page number', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/transactions')
        .query({ address: WALLET_ADDRESS, page: 0 });

      expect(res.status).toBe(400);
    });

    it('400 — rejects invalid limit', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/transactions')
        .query({ address: WALLET_ADDRESS, limit: 0 });

      expect(res.status).toBe(400);
    });
  });
});
