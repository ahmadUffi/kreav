import { Test } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    // ensure no leaked connection
    await service.$disconnect();
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  it('connects on module init (onModuleInit resolves)', async () => {
    // Should not throw; $connect is idempotent.
    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('disconnects on module destroy (onModuleDestroy resolves)', async () => {
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});
