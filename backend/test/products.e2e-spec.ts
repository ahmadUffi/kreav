import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DecimalToStringInterceptor } from '../src/common/serialization/decimal-to-string.interceptor';

/**
 * Product endpoints e2e — exercises the full HTTP stack (controller → service
 * → Prisma → Postgres) including the global DecimalToStringInterceptor and the
 * ValidationPipe.
 *
 * Requires a running Postgres (docker compose up -d kreav-db) + migrations.
 */
describe('ProductsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let creatorId: string;
  let createdProductId: string;

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

    // Create a fresh creator for this test run.
    const creator = await prisma.user.create({
      data: {
        email: `be004-e2e+${Date.now()}@kreav.test`,
        name: 'BE-004 E2E Creator',
        role: 'CREATOR',
      },
    });
    creatorId = creator.id;
  });

  afterAll(async () => {
    // Clean up everything this run created (products cascade nothing here, but
    // delete explicitly to be safe; user delete RESTRICTs on products, so drop
    // products first).
    await prisma.product.deleteMany({ where: { creatorId } });
    await prisma.user.delete({ where: { id: creatorId } });
    await app.close();
  });

  describe('POST /products', () => {
    it('201 — creates a product, money returned as string', async () => {
      const res = await request(app.getHttpServer()).post('/products').send({
        title: 'AI Interview Playbook',
        description: 'A guide',
        priceUsd: '10.00',
        creatorId,
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toEqual(expect.any(String));
      expect(res.body.title).toBe('AI Interview Playbook');
      // The critical Decimal→string assertion: "10.00", not {d:[...]}/10.
      expect(res.body.priceUsd).toBe('10.00');
      expect(res.body.creator.id).toBe(creatorId);

      createdProductId = res.body.id;
    });

    it('400 — rejects a non-decimal priceUsd', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .send({ title: 'X', priceUsd: 'abc', creatorId });

      expect(res.status).toBe(400);
    });

    it('400 — rejects a negative priceUsd', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .send({ title: 'X', priceUsd: '-5.00', creatorId });

      expect(res.status).toBe(400);
    });

    it('400 — rejects an empty title', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .send({ title: '', priceUsd: '10.00', creatorId });

      expect(res.status).toBe(400);
    });

    it('400 — rejects an unknown field (forbidNonWhitelisted)', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .send({ title: 'X', priceUsd: '10.00', creatorId, evil: true });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /products/:id', () => {
    it('200 — returns the product with creator, money as string', async () => {
      const res = await request(app.getHttpServer()).get(`/products/${createdProductId}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createdProductId);
      expect(res.body.priceUsd).toBe('10.00');
      expect(res.body.creator).toBeDefined();
    });

    it('404 — when product does not exist', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products/00000000-0000-0000-0000-000000000000',
      );

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Product not found');
    });
  });

  describe('GET /products', () => {
    it('200 — returns a paginated list filtered by creatorId', async () => {
      const res = await request(app.getHttpServer()).get(
        `/products?creatorId=${creatorId}&page=1&limit=20`,
      );

      expect(res.status).toBe(200);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data)).toBe(true);
      // money in list responses also stringified
      expect(res.body.data[0].priceUsd).toBe('10.00');
      expect(res.body.data[0].creator).toBeDefined();
    });
  });
});
