import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from './dto/pagination.dto';
import { CreateProductDto } from './dto/create-product.dto';

/**
 * ProductsService — Prisma-backed product catalog operations.
 *
 * Money handling: price is stored as Prisma Decimal(18,2) and returned as a
 * Prisma.Decimal to the controller. The global DecimalToStringInterceptor
 * converts it to a string ("10.00") in the HTTP response — the service layer
 * never stringifies money itself.
 *
 * Source: Kreav Backend PRD v3 — §6 Product Module, §9 Product APIs.
 */
@Injectable()
export class ProductsService {
  // Reused relation include so every product response carries its creator.
  private readonly includeCreator = {
    creator: { select: { id: true, name: true } },
  } as const satisfies Prisma.ProductInclude;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Paginated product list, optionally filtered by creator.
   * Ordered newest-first so the demo storefront shows fresh content.
   */
  async findAll(query: PaginationDto): Promise<{
    data: Array<Record<string, unknown>>;
    page: number;
    limit: number;
    total: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ProductWhereInput = query.creatorId ? { creatorId: query.creatorId } : {};

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        skip: (page - 1) * limit,
        take: limit,
        where,
        include: this.includeCreator,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, page, limit, total };
  }

  /**
   * Single product with creator. 404 when missing.
   */
  async findOne(id: string): Promise<Record<string, unknown>> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: this.includeCreator,
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  /**
   * Create a product. `priceUsd` arrives as a validated decimal string; we
   * wrap it in Prisma.Decimal so it is written as money, never float.
   * `fileUrl` is optional — the digital product download/access link.
   */
  async create(dto: CreateProductDto): Promise<Record<string, unknown>> {
    return this.prisma.product.create({
      data: {
        title: dto.title,
        description: dto.description,
        fileUrl: dto.fileUrl,
        priceUsd: new Prisma.Decimal(dto.priceUsd),
        creatorId: dto.creatorId,
      },
      include: this.includeCreator,
    });
  }
}
