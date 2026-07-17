import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DecimalToStringInterceptor } from '../src/common/serialization/decimal-to-string.interceptor';
import { DomainExceptionFilter } from '../src/common/exceptions/domain-exception.filter';
import { Keypair } from '@stellar/stellar-sdk';

const TEST_WALLET = Keypair.random().publicKey();

describe('AnalyticsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let creatorId: string;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalInterceptors(new DecimalToStringInterceptor());
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.wallet.deleteMany({ where: { walletAddress: TEST_WALLET } });

    const creator = await prisma.user.create({
      data: {
        email: `be019-e2e+${Date.now()}@kreav.test`,
        name: 'BE-019 E2E Creator',
        role: 'CREATOR',
      },
    });
    creatorId = creator.id;

    await prisma.wallet.create({
      data: { creatorId, walletAddress: TEST_WALLET, provider: 'FREIGHTER' },
    });

    token = app.get(JwtService).sign({ sub: creatorId, role: 'CREATOR', email: creator.email });

    // Create 1 ACTIVE product with SETTLED orders so analytics has data.
    const p1 = await prisma.product.create({
      data: { title: 'Active Product 1', priceUsd: 10.0, creatorId, status: 'ACTIVE' },
    });
    await prisma.order.create({
      data: {
        productId: p1.id,
        buyerEmail: 'buyer1@example.com',
        amountUsd: 10.0,
        status: 'SETTLED',
        paymentRef: `gcash-settled-1-${Date.now()}`,
      },
    });

    // ARCHIVED product with no orders — should be excluded from activeProducts count.
    await prisma.product.create({
      data: { title: 'Archived Product', priceUsd: 5.0, creatorId, status: 'ARCHIVED' },
    });

    // Another ACTIVE product with multiple SETTLED orders to exercise topProducts.
    const p2 = await prisma.product.create({
      data: { title: 'Active Product 2', priceUsd: 25.0, creatorId, status: 'ACTIVE' },
    });
    await prisma.order.create({
      data: {
        productId: p2.id,
        buyerEmail: 'buyer2@example.com',
        amountUsd: 25.0,
        status: 'SETTLED',
        paymentRef: `gcash-settled-2-${Date.now()}`,
      },
    });
    await prisma.order.create({
      data: {
        productId: p2.id,
        buyerEmail: 'buyer3@example.com',
        amountUsd: 25.0,
        status: 'SETTLED',
        paymentRef: `gcash-settled-3-${Date.now()}`,
      },
    });
  });

  afterAll(async () => {
    const productIds = (
      await prisma.product.findMany({ where: { creatorId }, select: { id: true } })
    ).map((p) => p.id);
    if (productIds.length) {
      await prisma.order.deleteMany({ where: { productId: { in: productIds } } });
    }
    await prisma.product.deleteMany({ where: { creatorId } });
    await prisma.wallet.deleteMany({ where: { creatorId } });
    await prisma.user.delete({ where: { id: creatorId } });
    await app.close();
  });

  describe('GET /analytics', () => {
    it('returns 200 KPI response with expected shape', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.totals).toBeDefined();
      expect(typeof res.body.totals.activeProducts).toBe('number');
      expect(typeof res.body.totals.revenueUsd).toBe('string');
      expect(typeof res.body.totals.sales).toBe('number');
    });

    it('activeProducts excludes ARCHIVED products', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      // 2 ACTIVE, 1 ARCHIVED → activeProducts === 2
      expect(res.body.totals.activeProducts).toBe(2);
    });

    it('revenueUsd is a decimal string, not a float', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(typeof res.body.totals.revenueUsd).toBe('string');
      expect(/^\d+\.\d{2}$/.test(res.body.totals.revenueUsd)).toBe(true);
      expect(res.body.totals.pendingPayout).toBeDefined();
      expect(typeof res.body.totals.pendingPayout).toBe('string');
      expect(/^\d+\.\d{2}$/.test(res.body.totals.pendingPayout)).toBe(true);
    });

    it('returns 401 without bearer token', async () => {
      const res = await request(app.getHttpServer()).get('/analytics');

      expect(res.status).toBe(401);
    });

    it('topProducts is an array with expected entry shape', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.topProducts)).toBe(true);
      expect(res.body.topProducts.length).toBeGreaterThanOrEqual(1);

      const entry = res.body.topProducts[0];
      expect(entry.productId).toEqual(expect.any(String));
      expect(entry.productTitle).toEqual(expect.any(String));
      expect(entry.revenue).toEqual(expect.any(String));
      expect(/^\d+\.\d{2}$/.test(entry.revenue)).toBe(true);
      expect(typeof entry.sales).toBe('number');
      expect(entry.sales).toBeGreaterThanOrEqual(1);
    });
  });
});
