import { Body, Controller, Get, Logger, NotFoundException, Put, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiQuery, ApiBody, ApiResponse } from '@nestjs/swagger';
import { SiteService } from './site.service';
import { SiteDto } from './dto';

/**
 * SiteController — BE-025.
 *
 *   GET /users/me/site  — get mini-site configuration
 *   PUT /users/me/site  — atomically replace mini-site config
 *
 * No auth middleware for MVP — uses `?userId=` query param.
 *
 * Source: BE-025 — Creator Mini-Site API.
 */
@ApiTags('Site')
@Controller('users/me/site')
export class SiteController {
  private readonly logger = new Logger(SiteController.name);

  constructor(private readonly site: SiteService) {}

  /**
   * GET /users/me/site?userId=<uuid>
   *
   * Returns the full mini-site configuration including social links,
   * custom links, and featured product IDs.
   */
  @Get()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Get mini-site configuration',
    description:
      'Returns the full mini-site configuration for the creator: ' +
      'profile fields (displayName, username, bio, avatarEmoji, accent), ' +
      'social media links, custom links (Linktree-style), and featured product IDs. ' +
      'No auth middleware for MVP — uses ?userId= query param.',
  })
  @ApiQuery({
    name: 'userId',
    description: 'User ID (UUID)',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Mini-site configuration retrieved',
    type: SiteDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getSite(@Query('userId') userId: string): Promise<SiteDto> {
    if (!userId) {
      throw new NotFoundException('userId query parameter is required');
    }
    this.logger.log(`GET /users/me/site?userId=${userId}`);
    return this.site.getSite(userId);
  }

  /**
   * PUT /users/me/site?userId=<uuid>
   *
   * Atomically replaces the entire mini-site configuration.
   * All-or-nothing transaction — deletes old relations and creates new ones.
   */
  @Put()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary: 'Update mini-site configuration',
    description:
      'Atomically replaces the entire mini-site configuration. ' +
      'Uses a Prisma transaction — all-or-nothing. ' +
      'Updates profile fields, replaces social links, custom links, and featured products. ' +
      'All fields in the body are required (use previous GET response as base for partial updates).',
  })
  @ApiQuery({
    name: 'userId',
    description: 'User ID (UUID)',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
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
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateSite(@Query('userId') userId: string, @Body() dto: SiteDto): Promise<SiteDto> {
    if (!userId) {
      throw new NotFoundException('userId query parameter is required');
    }
    this.logger.log(`PUT /users/me/site?userId=${userId}`);
    return this.site.updateSite(userId, dto);
  }
}
