import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DecimalToStringInterceptor } from '../src/common/serialization/decimal-to-string.interceptor';
import { DomainExceptionFilter } from '../src/common/exceptions/domain-exception.filter';
import { Keypair } from '@stellar/stellar-sdk';

describe('SiteController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const TEST_WALLET = Keypair.random().publicKey();

  let creatorA: { id: string; token: string };
  let creatorB: { id: string; token: string };
  let productA1: string;
  let productB: string;

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

    await prisma.wallet.deleteMany({ where: { walletAddress: TEST_WALLET } });

    const userA = await prisma.user.create({
      data: {
        email: `be025-e2e-a+${Date.now()}@kreav.test`,
        name: 'Creator A E2E',
        role: 'CREATOR',
      },
    });
    creatorA = {
      id: userA.id,
      token: app.get(JwtService).sign({ sub: userA.id, role: 'CREATOR', email: userA.email }),
    };

    await prisma.wallet.create({
      data: {
        creatorId: creatorA.id,
        walletAddress: TEST_WALLET,
        provider: 'FREIGHTER',
      },
    });

    const userB = await prisma.user.create({
      data: {
        email: `be025-e2e-b+${Date.now()}@kreav.test`,
        name: 'Creator B E2E',
        role: 'CREATOR',
      },
    });
    creatorB = {
      id: userB.id,
      token: app.get(JwtService).sign({ sub: userB.id, role: 'CREATOR', email: userB.email }),
    };

    const prodA1 = await prisma.product.create({
      data: {
        title: 'Creator A Product 1',
        priceUsd: '5.00',
        creatorId: creatorA.id,
      },
    });
    productA1 = prodA1.id;

    const prodB = await prisma.product.create({
      data: {
        title: 'Creator B Product',
        priceUsd: '7.00',
        creatorId: creatorB.id,
      },
    });
    productB = prodB.id;
  });

  afterAll(async () => {
    await prisma.featuredProduct.deleteMany({
      where: { userId: { in: [creatorA.id, creatorB.id] } },
    });
    await prisma.socialLink.deleteMany({
      where: { userId: { in: [creatorA.id, creatorB.id] } },
    });
    await prisma.customLink.deleteMany({
      where: { userId: { in: [creatorA.id, creatorB.id] } },
    });
    await prisma.order.deleteMany({
      where: { product: { creatorId: { in: [creatorA.id, creatorB.id] } } },
    });
    await prisma.product.deleteMany({
      where: { creatorId: { in: [creatorA.id, creatorB.id] } },
    });
    await prisma.wallet.deleteMany({
      where: { creatorId: { in: [creatorA.id, creatorB.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [creatorA.id, creatorB.id] } },
    });
    await app.close();
  });

  describe('GET /users/me/site', () => {
    it('200 — returns site config with displayName, username, featuredProductIds fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/me/site')
        .set('Authorization', `Bearer ${creatorA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.displayName).toBe('Creator A E2E');
      expect(res.body.username).toBe('');
      expect(res.body.featuredProductIds).toEqual([]);
    });
  });

  describe('PUT /users/me/site', () => {
    it('200 — updates site with valid featured products', async () => {
      const res = await request(app.getHttpServer())
        .put('/users/me/site')
        .set('Authorization', `Bearer ${creatorA.token}`)
        .send({
          displayName: 'Test',
          username: 'testuser',
          socials: {},
          links: [],
          featuredProductIds: [productA1],
        });

      expect(res.status).toBe(200);
      expect(res.body.displayName).toBe('Test');
      expect(res.body.username).toBe('testuser');
      expect(res.body.featuredProductIds).toEqual([productA1]);
    });

    it("403 — when featuredProductIds includes another creator's product", async () => {
      const res = await request(app.getHttpServer())
        .put('/users/me/site')
        .set('Authorization', `Bearer ${creatorA.token}`)
        .send({
          displayName: 'Test',
          username: 'testuser',
          socials: {},
          links: [],
          featuredProductIds: [productB],
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('does not belong to you');
    });

    it('404 — when user not found (invalid JWT with non-existent sub)', async () => {
      const fakeToken = app.get(JwtService).sign({
        sub: '00000000-0000-0000-0000-000000000000',
        role: 'CREATOR',
      });

      const res = await request(app.getHttpServer())
        .put('/users/me/site')
        .set('Authorization', `Bearer ${fakeToken}`)
        .send({
          displayName: 'Test',
          username: 'ghost',
          socials: {},
          links: [],
          featuredProductIds: [],
        });

      expect(res.status).toBe(404);
    });
  });
});
