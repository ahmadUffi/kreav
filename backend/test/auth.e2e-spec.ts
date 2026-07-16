import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const createdUserIds: string[] = [];

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
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.wallet.deleteMany({ where: { creatorId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('201 — creates a user and returns a token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `auth-e2e-new+${Date.now()}@kreav.test`,
          name: 'Auth E2E New User',
          role: 'CREATOR',
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        email: expect.stringContaining('@kreav.test'),
        name: 'Auth E2E New User',
        role: 'CREATOR',
        createdAt: expect.any(String),
        token: expect.any(String),
      });
      expect(res.body.token).toBeTruthy();
      expect(res.body.token.split('.').length).toBe(3);

      createdUserIds.push(res.body.id);
    });

    it('409 — rejects duplicate email', async () => {
      const email = `auth-e2e-dup+${Date.now()}@kreav.test`;

      const first = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, name: 'First User', role: 'CREATOR' });
      expect(first.status).toBe(201);
      createdUserIds.push(first.body.id);

      const second = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, name: 'Second User', role: 'CREATOR' });

      expect(second.status).toBe(409);
      expect(second.body.message).toContain('already registered');
    });

    it('400 — rejects invalid email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', name: 'Bad Email', role: 'CREATOR' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects empty name', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `auth-e2e-empty+${Date.now()}@kreav.test`, name: '', role: 'CREATOR' });

      expect(res.status).toBe(400);
    });

    it('201 — defaults role to BUYER when omitted', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `auth-e2e-default+${Date.now()}@kreav.test`,
          name: 'Default Role User',
        });

      expect(res.status).toBe(201);
      expect(res.body.role).toBe('BUYER');
      expect(res.body.token).toBeTruthy();

      createdUserIds.push(res.body.id);
    });
  });

  describe('POST /auth/verify (SEP-10)', () => {
    it.skip('SEP-10 verify reject replay (requires Stellar testnet + Freighter signing)', async () => {
      // The SEP-10 challenge flow uses Stellar WebAuth which requires:
      // - A real Stellar testnet connection
      // - A wallet (e.g. Freighter) to sign the challenge client-side
      // - Server-side challenge verification with timebounds + signatures
      //
      // Full C6 nonce-tracking logic (usedChallenges Map) is unit-tested in
      // auth.service.spec.ts.  This e2e test would duplicate that coverage
      // but requires external Stellar infra — skip for CI reliability.
    });
  });

  describe('POST /auth/logout', () => {
    it('200 — revokes a token and rejects subsequent use (M9 token revocation)', async () => {
      const register = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `auth-e2e-logout+${Date.now()}@kreav.test`,
          name: 'Logout Test User',
          role: 'CREATOR',
        });
      expect(register.status).toBe(201);
      const token = register.body.token;
      createdUserIds.push(register.body.id);

      const logoutRes = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`);
      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      const reuseRes = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`);
      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.message).toBe('Token has been revoked');
    });

    it('401 — rejects missing bearer token', async () => {
      const res = await request(app.getHttpServer()).post('/auth/logout');
      expect(res.status).toBe(401);
    });

    it('401 — rejects invalid bearer token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', 'Bearer not-a-jwt');
      expect(res.status).toBe(401);
    });
  });
});
