import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SiteDto } from './dto';

/**
 * SiteService — BE-025 mini-site read/update logic.
 *
 * Handles GET /users/me/site and PUT /users/me/site for the creator
 * mini-site (Linktree-style public page with socials, links, featured products).
 *
 * The PUT replaces the entire mini-site configuration atomically using
 * a Prisma transaction — all-or-nothing.
 *
 * Source: BE-025 — Creator Mini-Site API.
 */
@Injectable()
export class SiteService {
  private readonly logger = new Logger(SiteService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /users/me/site — return the full mini-site configuration.
   */
  async getSite(userId: string): Promise<SiteDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        socialLinks: { select: { platform: true, handle: true } },
        customLinks: {
          select: { label: true, url: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' },
        },
        featuredProducts: {
          select: { productId: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return this.toSiteDto(user);
  }

  /**
   * PUT /users/me/site — atomically replace the entire mini-site config.
   *
   * Uses a Prisma transaction to delete existing social links, custom links,
   * and featured products, then create the new ones. All-or-nothing.
   */
  async updateSite(userId: string, dto: SiteDto): Promise<SiteDto> {
    // Verify user exists.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Atomically replace all mini-site data.
    const updated = await this.prisma.$transaction(async (tx) => {
      // Update user profile fields.
      await tx.user.update({
        where: { id: userId },
        data: {
          name: dto.displayName,
          username: dto.username,
          bio: dto.bio ?? null,
          avatarEmoji: dto.avatarEmoji ?? null,
          accent: dto.accent ?? null,
        },
      });

      // Replace social links.
      await tx.socialLink.deleteMany({ where: { userId } });
      if (dto.socials) {
        const socialEntries = Object.entries(dto.socials)
          .filter(([, handle]) => handle)
          .map(([platform, handle]) => ({
            userId,
            platform: platform.toUpperCase(),
            handle: handle!,
          }));
        if (socialEntries.length > 0) {
          await tx.socialLink.createMany({ data: socialEntries });
        }
      }

      // Replace custom links.
      await tx.customLink.deleteMany({ where: { userId } });
      if (dto.links && dto.links.length > 0) {
        await tx.customLink.createMany({
          data: dto.links.map((link, i) => ({
            userId,
            label: link.label,
            url: link.url,
            sortOrder: i,
          })),
        });
      }

      // Replace featured products.
      await tx.featuredProduct.deleteMany({ where: { userId } });
      if (dto.featuredProductIds && dto.featuredProductIds.length > 0) {
        await tx.featuredProduct.createMany({
          data: dto.featuredProductIds.map((productId, i) => ({
            userId,
            productId,
            sortOrder: i,
          })),
        });
      }

      // Return the full updated state.
      return tx.user.findUnique({
        where: { id: userId },
        include: {
          socialLinks: { select: { platform: true, handle: true } },
          customLinks: {
            select: { label: true, url: true, sortOrder: true },
            orderBy: { sortOrder: 'asc' },
          },
          featuredProducts: {
            select: { productId: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
    });

    this.logger.log(`Mini-site updated for user ${userId}`);
    return this.toSiteDto(updated!);
  }

  /**
   * Map Prisma User + relations to the SiteDto shape.
   */
  private toSiteDto(user: {
    name: string;
    username: string | null;
    bio: string | null;
    avatarEmoji: string | null;
    accent: string | null;
    socialLinks: { platform: string; handle: string }[];
    customLinks: { label: string; url: string }[];
    featuredProducts: { productId: string }[];
  }): SiteDto {
    const socials: Record<string, string> = {};
    for (const sl of user.socialLinks) {
      socials[sl.platform.toLowerCase()] = sl.handle;
    }

    return {
      displayName: user.name,
      username: user.username ?? '',
      bio: user.bio ?? undefined,
      avatarEmoji: user.avatarEmoji ?? undefined,
      accent: user.accent ?? undefined,
      socials: {
        instagram: socials.instagram,
        x: socials.x,
        tiktok: socials.tiktok,
        youtube: socials.youtube,
      },
      links: user.customLinks.map((cl) => ({ label: cl.label, url: cl.url })),
      featuredProductIds: user.featuredProducts.map((fp) => fp.productId),
    };
  }
}
