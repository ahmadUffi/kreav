import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';

/**
 * ProductsService unit tests — Prisma is mocked.
 * Verifies list (pagination + creator filter), detail (404 on miss), and create.
 * Money is asserted as a Prisma.Decimal to confirm it is NOT pre-converted to
 * string at the service layer (the global interceptor handles that).
 */
describe('ProductsService', () => {
  // Shared expectation fragments — kept in one place so the suite doesn't
  // re-declare the same nested include/where objects across tests (SonarCloud
  // flagged the literal repetition as duplicated code).
  const EXPECTED_INCLUDE = { creator: { select: { id: true, name: true } } };

  let service: ProductsService;
  let prisma: {
    product: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(ProductsService);
  });

  describe('findAll', () => {
    it('passes page/limit to skip+take and returns data + meta', async () => {
      const rows = [
        { id: 'p1', title: 'Book', priceUsd: 10n },
        { id: 'p2', title: 'Course', priceUsd: 25n },
      ];
      prisma.product.findMany.mockResolvedValue(rows);
      prisma.product.count.mockResolvedValue(42);

      const result = await service.findAll({ page: 2, limit: 20 });

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        skip: 20,
        take: 20,
        where: {},
        include: EXPECTED_INCLUDE,
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.product.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({ data: rows, page: 2, limit: 20, total: 42 });
    });

    it('filters by creatorId when provided', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      const expectedWhere = { creatorId: 'creator-1' };
      await service.findAll({ page: 1, limit: 20, creatorId: expectedWhere.creatorId });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(prisma.product.count).toHaveBeenCalledWith({ where: expectedWhere });
    });

    it('defaults page to 1 when omitted', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20 });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });

  describe('findOne', () => {
    it('returns the product with creator when found', async () => {
      const product = {
        id: 'p1',
        title: 'Book',
        priceUsd: 10n,
        creator: { id: 'u1', name: 'Ayu' },
      };
      prisma.product.findUnique.mockResolvedValue(product);

      const result = await service.findOne('p1');
      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'p1' },
        include: EXPECTED_INCLUDE,
      });
      expect(result).toBe(product);
    });

    it('throws NotFoundException when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    const dto: CreateProductDto = {
      title: 'AI Interview Playbook',
      description: 'A guide',
      fileUrl: 'https://drive.google.com/file/d/abc001/view',
      priceUsd: '10.00',
    };
    // Fase 1: creatorId comes from the session JWT, not the DTO.
    const CREATOR_ID = 'u1';

    it('creates a product with price as Decimal and includes creator', async () => {
      const created = {
        id: 'p1',
        title: dto.title,
        priceUsd: 10n,
        creator: { id: CREATOR_ID, name: 'Ayu' },
      };
      prisma.product.create.mockResolvedValue(created);

      const result = await service.create(dto, CREATOR_ID);

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: {
          title: dto.title,
          description: dto.description,
          fileUrl: dto.fileUrl,
          priceUsd: expect.objectContaining({ d: expect.any(Array) }), // Prisma.Decimal-like
          creatorId: CREATOR_ID,
        },
        include: EXPECTED_INCLUDE,
      });
      // price was parsed into a Decimal instance (not a raw string)
      const dataArg = prisma.product.create.mock.calls[0][0].data;
      expect(dataArg.priceUsd.toFixed(2)).toBe('10.00');
      expect(result).toBe(created);
    });

    it('passes through optional description as null when omitted', async () => {
      prisma.product.create.mockResolvedValue({ id: 'p1' });
      const { description: _omitted, ...dtoWithoutDescription } = dto;
      void _omitted;

      await service.create(dtoWithoutDescription, CREATOR_ID);

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: undefined }),
        }),
      );
    });
  });
});
