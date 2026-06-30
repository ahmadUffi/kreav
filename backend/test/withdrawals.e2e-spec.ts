import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DecimalToStringInterceptor } from '../src/common/serialization/decimal-to-string.interceptor';
import { DomainExceptionFilter } from '../src/common/exceptions/domain-exception.filter';

/**
 * Withdrawal endpoints e2e — exercises the full withdrawal flow against a
 * real Postgres (POST/GET /withdrawals).
 *
 * Requires a running Postgres (docker compose up -d kreav-db) + migrations.
 */
describe('WithdrawalsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const WALLET_ADDRESS = 'GCHOG4QF27OG5WHBY4AIBGEI4LSOTCY3Y4VX22AUNLHTDBWMLZW5OBU3';
  let creatorId: string;

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

    // Ensure wallet exists
    const existingWallet = await prisma.wallet.findFirst({
      where: { walletAddress: WALLET_ADDRESS },
    });

    if (!existingWallet) {
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
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /withdrawals', () => {
    it('202 — creates a withdrawal with PROCESSING status', async () => {
      const res = await request(app.getHttpServer())
        .post('/withdrawals')
        .query({ address: WALLET_ADDRESS })
        .send({ amount: 5.0, destinationType: 'GCASH', destinationAccount: '0917xxxxxxx' });

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('PROCESSING');
      expect(res.body.reference).toContain('KRV-WD');
      expect(res.body.amount).toBe(5.0);
      expect(res.body.withdrawalId).toEqual(expect.any(String));
      expect(res.body.simulation).toBeDefined();
      expect(res.body.simulation.mode).toBe('SIMULATED');
    });

    it('400 — rejects invalid amount (zero)', async () => {
      const res = await request(app.getHttpServer())
        .post('/withdrawals')
        .query({ address: WALLET_ADDRESS })
        .send({ amount: 0, destinationType: 'GCASH', destinationAccount: '0917xxxxxxx' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects invalid amount (negative)', async () => {
      const res = await request(app.getHttpServer())
        .post('/withdrawals')
        .query({ address: WALLET_ADDRESS })
        .send({ amount: -5.0, destinationType: 'GCASH', destinationAccount: '0917xxxxxxx' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects invalid destination type', async () => {
      const res = await request(app.getHttpServer())
        .post('/withdrawals')
        .query({ address: WALLET_ADDRESS })
        .send({ amount: 5.0, destinationType: 'INVALID', destinationAccount: '0917xxxxxxx' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects missing destination account', async () => {
      const res = await request(app.getHttpServer())
        .post('/withdrawals')
        .query({ address: WALLET_ADDRESS })
        .send({ amount: 5.0, destinationType: 'GCASH', destinationAccount: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /withdrawals/:id', () => {
    it('200 — returns a completed withdrawal receipt after polling', async () => {
      // First create a withdrawal
      const createRes = await request(app.getHttpServer())
        .post('/withdrawals')
        .query({ address: WALLET_ADDRESS })
        .send({ amount: 1.0, destinationType: 'BANK', destinationAccount: '1234567890' });

      expect(createRes.status).toBe(202);
      const withdrawalId = createRes.body.withdrawalId;

      // Wait for simulation delay + buffer
      await new Promise((r) => setTimeout(r, 3000));

      // Now poll — should be COMPLETED via lazy transition
      const getRes = await request(app.getHttpServer()).get(`/withdrawals/${withdrawalId}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.status).toBe('COMPLETED');
      expect(getRes.body.withdrawalId).toBe(withdrawalId);
      expect(getRes.body.completedAt).toBeTruthy();
      expect(getRes.body.simulation).toBeDefined();
    });

    it('404 — for unknown withdrawal ID', async () => {
      const res = await request(app.getHttpServer()).get(
        '/withdrawals/00000000-0000-0000-0000-000000000000',
      );

      expect(res.status).toBe(404);
    });
  });

  describe('GET /withdrawals', () => {
    it('200 — returns paginated withdrawal list', async () => {
      const res = await request(app.getHttpServer())
        .get('/withdrawals')
        .query({ address: WALLET_ADDRESS, page: 1, limit: 20 });

      expect(res.status).toBe(200);
      expect(res.body.address).toBe(WALLET_ADDRESS);
      expect(Array.isArray(res.body.withdrawals)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
    });

    it('400 — rejects invalid address', async () => {
      const res = await request(app.getHttpServer())
        .get('/withdrawals')
        .query({ address: 'bad-address' });

      expect(res.status).toBe(400);
    });
  });
});
