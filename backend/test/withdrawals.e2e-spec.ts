import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DecimalToStringInterceptor } from '../src/common/serialization/decimal-to-string.interceptor';
import { DomainExceptionFilter } from '../src/common/exceptions/domain-exception.filter';

/**
 * Withdrawal endpoints e2e — exercises the full withdrawal flow against a
 * real Postgres (POST/GET /withdrawals).
 *
 * Fase 1 contract: all withdrawal endpoints are JWT-guarded; the wallet
 * address is resolved server-side from the authenticated creator's connected
 * wallet — there is no `?address=` query param anymore.
 *
 * Requires a running Postgres + migrations.
 */
describe('WithdrawalsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const WALLET_ADDRESS = 'GD76WTN7LGHUKWT4JNSEXVFIZYTVPXZH6S3WDKI7LQXYXTL6ALUTSRFA';
  let creatorId: string;
  /** Session JWT for the test creator (minted directly via JwtService). */
  let token: string;

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
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);

    // Ensure test creator exists
    const existing = await prisma.user.findUnique({
      where: { email: 'withdrawal-e2e@kreav.test' },
    });

    if (existing) {
      creatorId = existing.id;
    } else {
      const creator = await prisma.user.create({
        data: {
          email: 'withdrawal-e2e@kreav.test',
          name: 'Withdrawal E2E Creator',
          role: 'CREATOR',
        },
      });
      creatorId = creator.id;
    }

    // Mint a session token for the creator (JwtModule is global).
    token = app
      .get(JwtService)
      .sign({ sub: creatorId, role: 'CREATOR', email: 'withdrawal-e2e@kreav.test' });

    // Clean up leftovers from previous runs, then connect wallet.
    await prisma.wallet.deleteMany({ where: { walletAddress: WALLET_ADDRESS } });
    await prisma.wallet.create({
      data: {
        creatorId,
        walletAddress: WALLET_ADDRESS,
        provider: 'FREIGHTER',
      },
    });

    // Create a settlement + recipient so there's withdrawable balance
    const product = await prisma.product.create({
      data: {
        title: 'WD E2E Product',
        priceUsd: '10.00',
        creatorId,
      },
    });

    const order = await prisma.order.create({
      data: {
        productId: product.id,
        buyerEmail: 'wde2e-buyer@test.com',
        amountUsd: '10.00',
        status: 'SETTLED',
        txHash: 'wd-e2e-tx-hash',
        paymentRef: `wd-e2e-${Date.now()}`,
      },
    });

    const settlement = await prisma.settlement.create({
      data: {
        orderId: order.id,
        totalAmount: '10.00',
        txHash: 'wd-e2e-tx-hash',
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /withdrawals', () => {
    it('401 — rejects a request without a bearer token', async () => {
      const res = await request(app.getHttpServer())
        .post('/withdrawals')
        .send({ amount: 5.0, destinationType: 'GCASH', destinationAccount: '0917xxxxxxx' });

      expect(res.status).toBe(401);
    });

    it('202 — creates a withdrawal with PROCESSING status', async () => {
      const res = await request(app.getHttpServer())
        .post('/withdrawals')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 5.0, destinationType: 'GCASH', destinationAccount: '0917xxxxxxx' });

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('PROCESSING');
      expect(res.body.receiptVersion).toBe('1.0');
      expect(res.body.reference).toContain('KRV-WD');
      expect(res.body.amount).toBe(5.0);
      expect(res.body.withdrawalId).toEqual(expect.any(String));
      expect(res.body.simulation).toBeDefined();
      expect(res.body.simulation.mode).toBe('SIMULATED');
    });

    it('400 — rejects invalid amount (zero)', async () => {
      const res = await request(app.getHttpServer())
        .post('/withdrawals')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 0, destinationType: 'GCASH', destinationAccount: '0917xxxxxxx' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects invalid amount (negative)', async () => {
      const res = await request(app.getHttpServer())
        .post('/withdrawals')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: -5.0, destinationType: 'GCASH', destinationAccount: '0917xxxxxxx' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects invalid destination type', async () => {
      const res = await request(app.getHttpServer())
        .post('/withdrawals')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 5.0, destinationType: 'INVALID', destinationAccount: '0917xxxxxxx' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects missing destination account', async () => {
      const res = await request(app.getHttpServer())
        .post('/withdrawals')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 5.0, destinationType: 'GCASH', destinationAccount: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /withdrawals/:id', () => {
    it('200 — returns a completed withdrawal receipt after polling', async () => {
      // First create a withdrawal
      const createRes = await request(app.getHttpServer())
        .post('/withdrawals')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 1.0, destinationType: 'BANK', destinationAccount: '1234567890' });

      expect(createRes.status).toBe(202);
      const withdrawalId = createRes.body.withdrawalId;

      // Wait for simulation delay + buffer
      await new Promise((r) => setTimeout(r, 3000));

      // Now poll — should be COMPLETED via lazy transition
      const getRes = await request(app.getHttpServer())
        .get(`/withdrawals/${withdrawalId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.status).toBe('COMPLETED');
      expect(getRes.body.withdrawalId).toBe(withdrawalId);
      expect(getRes.body.completedAt).toBeTruthy();
      expect(getRes.body.simulation).toBeDefined();
    });

    it("404 — another creator's withdrawal (ownership check, no existence leak)", async () => {
      // Create a withdrawal as the main creator…
      const createRes = await request(app.getHttpServer())
        .post('/withdrawals')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 1.0, destinationType: 'BANK', destinationAccount: '1234567890' });
      expect(createRes.status).toBe(202);

      // …then try to read it with a token for a DIFFERENT (fake) creator.
      const strangerToken = app
        .get(JwtService)
        .sign({ sub: '00000000-0000-0000-0000-00000000dead', role: 'CREATOR' });

      const res = await request(app.getHttpServer())
        .get(`/withdrawals/${createRes.body.withdrawalId}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(404);
    });

    it('404 — for unknown withdrawal ID', async () => {
      const res = await request(app.getHttpServer())
        .get('/withdrawals/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /withdrawals', () => {
    it('401 — rejects a request without a bearer token', async () => {
      const res = await request(app.getHttpServer()).get('/withdrawals');
      expect(res.status).toBe(401);
    });

    it('200 — returns paginated withdrawal list', async () => {
      const res = await request(app.getHttpServer())
        .get('/withdrawals')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 20 });

      expect(res.status).toBe(200);
      expect(res.body.address).toBe(WALLET_ADDRESS);
      expect(Array.isArray(res.body.withdrawals)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
    });
  });
});
