import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { Keypair } from '@stellar/stellar-sdk';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DecimalToStringInterceptor } from '../src/common/serialization/decimal-to-string.interceptor';

/**
 * Wallet endpoints e2e — exercises GET /wallet/balance and
 * GET /wallet/transactions against a real Postgres.
 *
 * Fase 1 contract: both endpoints are JWT-guarded and the wallet address is
 * resolved server-side from the authenticated creator's connected wallet —
 * there is no `?address=` query param anymore.
 *
 * Requires a running Postgres + migrations.
 */
describe('WalletsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  /** Session token of a creator WITH a connected wallet. */
  let token: string;
  /** The connected wallet address for that creator. */
  let walletAddress: string;
  /** Session token of a creator WITHOUT a connected wallet. */
  let walletlessToken: string;

  const createdUserIds: string[] = [];

  async function registerCreator(tag: string): Promise<{ token: string; id: string }> {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `wallet-e2e-${tag}+${Date.now()}@kreav.test`,
        name: `Wallet E2E ${tag}`,
        role: 'CREATOR',
      });
    expect(res.status).toBe(201);
    createdUserIds.push(res.body.id);
    return { token: res.body.token, id: res.body.id };
  }

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

    // Creator A: register + connect a wallet.
    const creatorA = await registerCreator('with-wallet');
    token = creatorA.token;
    walletAddress = Keypair.random().publicKey();
    const connectRes = await request(app.getHttpServer())
      .post('/wallets')
      .set('Authorization', `Bearer ${token}`)
      .send({ walletAddress, provider: 'FREIGHTER' });
    expect(connectRes.status).toBe(201);

    // Creator B: registered but no wallet connected.
    const creatorB = await registerCreator('no-wallet');
    walletlessToken = creatorB.token;
  });

  afterAll(async () => {
    // Delete in FK-dependency order: settlement_recipients → settlements → orders → products → wallets → users
    await prisma.settlementRecipient.deleteMany({
      where: { settlement: { order: { product: { creatorId: { in: createdUserIds } } } } },
    });
    await prisma.settlement.deleteMany({
      where: { order: { product: { creatorId: { in: createdUserIds } } } },
    });
    await prisma.order.deleteMany({
      where: { product: { creatorId: { in: createdUserIds } } },
    });
    await prisma.product.deleteMany({ where: { creatorId: { in: createdUserIds } } });
    await prisma.wallet.deleteMany({ where: { creatorId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  describe('GET /wallet/balance', () => {
    it('401 — rejects a request without a bearer token', async () => {
      const res = await request(app.getHttpServer()).get('/wallet/balance');
      expect(res.status).toBe(401);
    });

    it('401 — rejects an invalid bearer token', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/balance')
        .set('Authorization', 'Bearer not-a-jwt');
      expect(res.status).toBe(401);
    });

    it('404 — creator without a connected wallet', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/balance')
        .set('Authorization', `Bearer ${walletlessToken}`);
      expect(res.status).toBe(404);
    });

    // Skipped: requires Stellar testnet connectivity (Horizon must be reachable).
    // The auth + address resolution logic is covered by the 401/404 tests above.
    it.skip('resolves the balance for the connected wallet (requires Stellar testnet)', async () => {
      // With an unconfigured/unreachable Horizon the downstream call may 5xx,
      // but auth + address resolution must succeed (never 400/401/404).
      const res = await request(app.getHttpServer())
        .get('/wallet/balance')
        .set('Authorization', `Bearer ${token}`);

      expect([400, 401, 404]).not.toContain(res.status);
      if (res.status === 200) {
        expect(res.body.address).toBe(walletAddress);
      }
    });
  });

  describe('GET /wallet/transactions', () => {
    it('401 — rejects a request without a bearer token', async () => {
      const res = await request(app.getHttpServer()).get('/wallet/transactions');
      expect(res.status).toBe(401);
    });

    it('404 — creator without a connected wallet', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/transactions')
        .set('Authorization', `Bearer ${walletlessToken}`);
      expect(res.status).toBe(404);
    });

    it('200 — returns empty transactions for a fresh wallet', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/transactions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.address).toBe(walletAddress);
      expect(res.body.transactions).toEqual([]);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
      expect(res.body.total).toBe(0);
    });

    it('200 — returns transactions once the wallet has settlement history', async () => {
      // Create test data: a product, order, settlement, and recipient row
      // pointing at the connected wallet address.
      const creatorId = createdUserIds[0];
      const product = await prisma.product.create({
        data: {
          title: 'Test Product',
          priceUsd: '10.00',
          creatorId,
        },
      });

      const order = await prisma.order.create({
        data: {
          productId: product.id,
          buyerEmail: 'buyer@test.com',
          amountUsd: '10.00',
          status: 'SETTLED',
          txHash: 'e2e000000000000000000000000000000000000000000000000000000000abcd',
          paymentRef: `wallet-e2e-ref-${Date.now()}`,
        },
      });

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
          walletAddress,
          recipientType: 'CREATOR',
          role: 'Author',
          percentage: '95.00',
          amount: '9.50',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/wallet/transactions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.address).toBe(walletAddress);
      expect(res.body.transactions.length).toBeGreaterThanOrEqual(1);

      const tx = res.body.transactions.find((t: any) => t.orderId === order.id);
      expect(tx).toBeDefined();
      expect(tx.amount).toBe('9.50');
      expect(tx.totalAmount).toBe('10.00');
      expect(tx.recipientType).toBe('CREATOR');
      expect(tx.role).toBe('Author');
      expect(tx.percentage).toBe('95.00');
      expect(tx.txHash).toBe(order.txHash);
      // BE-010: explorerLink must be a valid URL containing the tx hash
      expect(tx.explorerLink).toBeDefined();
      expect(tx.explorerLink).toContain('stellar.expert');
      expect(tx.explorerLink).toContain(order.txHash);
      expect(tx.status).toBe('COMPLETED');

      // Cleanup
      await prisma.settlementRecipient.deleteMany({
        where: { settlementId: settlement.id },
      });
      await prisma.settlement.delete({ where: { id: settlement.id } });
      await prisma.order.delete({ where: { id: order.id } });
      await prisma.product.delete({ where: { id: product.id } });
    });

    it('200 — respects pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/transactions')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 2, limit: 5 });

      expect(res.status).toBe(200);
      expect(res.body.page).toBe(2);
      expect(res.body.limit).toBe(5);
    });

    it('400 — rejects invalid page number', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/transactions')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 0 });

      expect(res.status).toBe(400);
    });

    it('400 — rejects invalid limit', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/transactions')
        .set('Authorization', `Bearer ${token}`)
        .query({ limit: 0 });

      expect(res.status).toBe(400);
    });
  });
});
