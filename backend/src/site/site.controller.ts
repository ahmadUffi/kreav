import { Body, Controller, Get, Logger, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SiteService } from './site.service';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SiteDto } from './dto';

/**
 * SiteController — BE-025 + Fase 1 (token-scoped identity).
 *
 *   GET /users/me/site  — get mini-site configuration   (JWT)
 *   PUT /users/me/site  — atomically replace config     (JWT)
 *
 * Identity comes from the session JWT — never from query params.
 *
 * Source: BE-025 — Creator Mini-Site API + ROADMAP Fase 1.
 */
@ApiTags('Site')
@Controller('users/me/site')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SiteController {
  private readonly logger = new Logger(SiteController.name);

  constructor(private readonly site: SiteService) {}

  /**
   * GET /users/me/site — mini-site config of the authenticated user.
   */
  @Get()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Get mini-site configuration',
    description:
      'Returns the full mini-site configuration for the authenticated creator: ' +
      'profile fields (displayName, username, bio, avatarEmoji, accent), ' +
      'social media links, custom links (Linktree-style), and featured product IDs.',
  })
  @ApiResponse({
    status: 200,
    description: 'Mini-site configuration retrieved',
    type: SiteDto,
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid bearer token' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getSite(@CurrentUser() user: AuthUser): Promise<SiteDto> {
    this.logger.log(`GET /users/me/site user=${user.userId}`);
    return this.site.getSite(user.userId);
  }

  /**
   * PUT /users/me/site — atomically replace the mini-site config.
   */
  @Put()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary: 'Update mini-site configuration',
    description:
      'Atomically replaces the entire mini-site configuration for the ' +
      'authenticated creator. Uses a Prisma transaction — all-or-nothing. ' +
      'Updates profile fields, replaces social links, custom links, and featured products. ' +
      'All fields in the body are required (use previous GET response as base for partial updates).',
  })
  @ApiBody({
    type: SiteDto,
    description: 'Full mini-site configuration',
    examples: {
      default: {
        summary: '🇮🇩 Maya Tan mini-site',
        value: {
          displayName: 'Maya Tan',
          username: 'maya.shoots',
          bio: 'Photographer & preset maker from Jakarta.',
          avatarEmoji: '🌅',
          accent: '#FF3BFF',
          socials: {
            instagram: 'maya.shoots',
            x: 'mayashoots',
            tiktok: 'maya.shoots',
            youtube: '@mayashoots',
          },
          links: [
            { label: 'My Lightroom workflow (free)', url: 'https://example.com/workflow' },
            { label: 'Book a 1:1 editing session', url: 'https://example.com/booking' },
          ],
          featuredProductIds: ['p1', 'p6', 'p3'],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Mini-site configuration updated',
    type: SiteDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing/invalid bearer token' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateSite(@CurrentUser() user: AuthUser, @Body() dto: SiteDto): Promise<SiteDto> {
    this.logger.log(`PUT /users/me/site user=${user.userId}`);
    return this.site.updateSite(user.userId, dto);
  }
}
