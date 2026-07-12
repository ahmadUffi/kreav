import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CollaboratorStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HorizonService } from '../stellar/horizon.service';
import { PaginationDto } from './dto/pagination.dto';
import { CreateCollaboratorDto, CreateProductDto } from './dto/create-product.dto';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly horizon: HorizonService,
  ) {}

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
   * `creatorId` comes from the session JWT (Fase 1), never from the body.
   */
  async create(dto: CreateProductDto, creatorId: string): Promise<Record<string, unknown>> {
    // Resolve the revenue-split recipient list. A product with NO collaborators
    // can never settle (SettlementService rejects an empty recipient vector), so
    // when the caller omits them we default to the creator at 100% using their
    // connected wallet. The collaborator field stays optional for the caller.
    const collaborators = await this.resolveCollaborators(dto.collaborators, creatorId);

    return this.prisma.product.create({
      data: {
        title: dto.title,
        description: dto.description,
        fileUrl: dto.fileUrl,
        priceUsd: new Prisma.Decimal(dto.priceUsd),
        creatorId,
        collaborators: {
          create: collaborators.map((c) => ({
            walletAddress: c.walletAddress,
            role: c.role,
            revenuePercentage: c.revenuePercentage,
            status: CollaboratorStatus.ACTIVE,
          })),
        },
      },
      include: this.includeCreator,
    });
  }

  /**
   * Build the collaborator rows to persist with a new product.
   *
   * - Explicit list → validate the shares sum to exactly 100.00, then use it.
   * - Omitted/empty → default to the creator as the sole collaborator at 100%,
   *   sourced from their most-recently connected wallet. Throws 400 if the
   *   creator has no wallet yet — a product with no payable recipient could
   *   never settle, so we fail fast with an actionable message.
   */
  private async resolveCollaborators(
    input: CreateCollaboratorDto[] | undefined,
    creatorId: string,
  ): Promise<Array<{ walletAddress: string; role: string; revenuePercentage: Prisma.Decimal }>> {
    if (input && input.length > 0) {
      const parsed = input.map((c) => ({
        walletAddress: c.walletAddress,
        role: c.role,
        revenuePercentage: new Prisma.Decimal(c.revenuePercentage),
      }));
      const sum = parsed.reduce((acc, c) => acc.plus(c.revenuePercentage), new Prisma.Decimal(0));
      if (!sum.equals(100)) {
        throw new BadRequestException(
          `Collaborator revenue percentages must sum to 100.00 (got ${sum.toString()}).`,
        );
      }
      // Every collaborator must be a payable recipient: registered on Kreav AND
      // holding a USDC trustline. Otherwise the on-chain settle would revert
      // (op_no_trust) and burn the fee for everyone. Fail fast at add-time.
      await this.assertCollaboratorsEligible(parsed.map((c) => c.walletAddress));
      return parsed;
    }

    // No collaborators supplied → the creator is the sole recipient at 100%.
    const wallet = await this.prisma.wallet.findFirst({
      where: { creatorId },
      orderBy: { connectedAt: 'desc' },
      select: { walletAddress: true },
    });
    if (!wallet) {
      throw new BadRequestException(
        'Connect a wallet before creating a product — the creator must be a revenue recipient.',
      );
    }
    // Solo products still need a payable wallet: enforce the creator's own USDC
    // trustline before creation (same rule as collaborators).
    let state: { hasUsdcTrustline: boolean };
    try {
      state = await this.horizon.getUsdcBalance(wallet.walletAddress);
    } catch {
      throw new BadRequestException(
        "Couldn't verify your USDC trustline right now — please try again.",
      );
    }
    if (!state.hasUsdcTrustline) {
      throw new BadRequestException(
        'Activate your USDC trustline before creating a product — both solo and collaborative products need a wallet that can receive USDC.',
      );
    }
    return [
      {
        walletAddress: wallet.walletAddress,
        role: 'Creator',
        revenuePercentage: new Prisma.Decimal(100),
      },
    ];
  }

  /**
   * Ensure every collaborator wallet can actually be paid: it must be registered
   * on Kreav (present in the Wallet table) AND hold a USDC trustline (checked via
   * Horizon). Throws a 400 with an actionable message for the first failure.
   * Unlike settlement's soft-degrade pre-check, add-time verification is strict —
   * if Horizon can't be reached we cannot confirm the trustline, so we reject.
   */
  private async assertCollaboratorsEligible(wallets: string[]): Promise<void> {
    const unique = [...new Set(wallets)];
    const short = (a: string) => `${a.slice(0, 8)}…`;

    await Promise.all(
      unique.map(async (address) => {
        const registered = await this.prisma.wallet.findFirst({
          where: { walletAddress: address },
          select: { id: true },
        });
        if (!registered) {
          throw new BadRequestException(
            `Collaborator wallet ${short(address)} is not registered on Kreav — they must connect their wallet first.`,
          );
        }

        let state: { hasUsdcTrustline: boolean };
        try {
          state = await this.horizon.getUsdcBalance(address);
        } catch {
          throw new BadRequestException(
            `Couldn't verify the USDC trustline for ${short(address)} right now — please try again.`,
          );
        }
        if (!state.hasUsdcTrustline) {
          throw new BadRequestException(
            `Collaborator wallet ${short(address)} has no USDC trustline — they must activate USDC before being added as a collaborator.`,
          );
        }
      }),
    );
  }
}
