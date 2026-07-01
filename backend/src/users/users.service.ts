import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpdateProfileDto,
  ProfileResponseDto,
  CheckUsernameResponseDto,
  PublicProfileResponseDto,
} from './dto';

/**
 * UsersService — BE-022 profile read/update logic.
 *
 * Handles GET /users/me and PATCH /users/me for the creator profile.
 * No auth middleware for MVP — uses `userId` query param.
 *
 * Source: BE-022 — Creator Profile API.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /users/me — return the full profile for a user.
   */
  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return this.toProfileResponse(user);
  }

  /**
   * PATCH /users/me — update profile fields.
   *
   * Supports partial updates — only provided fields are changed.
   * Checks username uniqueness if a new username is provided.
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // If changing username, check uniqueness.
    if (dto.username && dto.username !== user.username) {
      const existing = await this.prisma.user.findUnique({
        where: { username: dto.username },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(
          `Username "${dto.username}" is already taken`,
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.username !== undefined && { username: dto.username }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.avatarEmoji !== undefined && { avatarEmoji: dto.avatarEmoji }),
        ...(dto.accent !== undefined && { accent: dto.accent }),
      },
    });

    this.logger.log(`Profile updated: ${updated.id}`);

    return this.toProfileResponse(updated);
  }

  /**
   * Map a Prisma User to the ProfileResponseDto shape.
   */
  private toProfileResponse(user: {
    id: string;
    email: string;
    name: string;
    username: string | null;
    country: string | null;
    bio: string | null;
    avatarEmoji: string | null;
    accent: string | null;
    role: string;
    createdAt: Date;
  }): ProfileResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username ?? undefined,
      country: user.country ?? undefined,
      bio: user.bio ?? undefined,
      avatarEmoji: user.avatarEmoji ?? undefined,
      accent: user.accent ?? undefined,
      role: user.role,
      createdAt:
        user.createdAt instanceof Date
          ? user.createdAt.toISOString()
          : String(user.createdAt),
    };
  }

  // ── BE-024: Username Check ───────────────────────────────────────────────

  /**
   * GET /users/check-username — check if a username is available.
   */
  async checkUsername(username: string): Promise<CheckUsernameResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    return { username, available: !existing };
  }

  // ── BE-023: Public Profile ────────────────────────────────────────────────

  /**
   * GET /users/:username/profile — public creator profile.
   *
   * Returns basic profile info + the creator's products (public only).
   * No email, no wallet details. Throws 404 if username not found.
   */
  async getPublicProfile(username: string): Promise<PublicProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        products: {
          select: {
            id: true,
            title: true,
            priceUsd: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Creator "${username}" not found`);
    }

    return {
      username: user.username!,
      displayName: user.name,
      bio: user.bio ?? undefined,
      country: user.country ?? undefined,
      avatarEmoji: user.avatarEmoji ?? undefined,
      accent: user.accent ?? undefined,
      products: user.products.map((p) => ({
        id: p.id,
        title: p.title,
        priceUsd: p.priceUsd?.toFixed?.(2) ?? String(p.priceUsd),
      })),
    };
  }
}
