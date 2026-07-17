import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * DB connectivity e2e — uses the DATABASE_URL from .env (SQLite for local dev,
 * PostgreSQL for CI/production). Verifies the PrismaService can actually reach
 * the database and run a query, not just that the module compiles.
 */
describe('PrismaService DB connectivity (e2e)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          // No validation schema here — DATABASE_URL comes from process.env (.env).
        }),
      ],
      providers: [PrismaService],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
    await moduleRef.close();
  });

  it('runs a trivial query against PostgreSQL', async () => {
    const result = await prisma.$queryRaw`SELECT 1 AS "ok"`;
    // pg returns BigInt for raw integer expressions in some drivers
    const row = (result as Array<Record<string, unknown>>)[0];
    expect(Number(row.ok)).toBe(1);
  });
});
