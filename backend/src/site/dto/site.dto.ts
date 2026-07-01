import { ApiProperty } from '@nestjs/swagger';

/**
 * A single custom link (Linktree-style) on the mini-site.
 */
class CustomLinkDto {
  @ApiProperty({ description: 'Link label', example: 'My Lightroom workflow (free)' })
  label!: string;

  @ApiProperty({ description: 'Link URL', example: 'https://example.com/workflow' })
  url!: string;
}

/**
 * Social media links for a creator mini-site.
 */
class SocialsDto {
  @ApiProperty({ required: false, example: 'maya.shoots' })
  instagram?: string;

  @ApiProperty({ required: false, example: 'mayashoots' })
  x?: string;

  @ApiProperty({ required: false, example: 'maya.shoots' })
  tiktok?: string;

  @ApiProperty({ required: false, example: '@mayashoots' })
  youtube?: string;
}

/**
 * Request/response body for GET/PUT /users/me/site.
 *
 * The PUT replaces the entire mini-site configuration atomically.
 *
 * Source: BE-025 — Creator Mini-Site API.
 */
export class SiteDto {
  @ApiProperty({ description: 'Display name', example: 'Maya Tan' })
  displayName!: string;

  @ApiProperty({ description: 'Username', example: 'maya.shoots' })
  username!: string;

  @ApiProperty({ description: 'Short bio', required: false, example: 'Photographer & preset maker from Jakarta.' })
  bio?: string;

  @ApiProperty({ description: 'Avatar emoji', required: false, example: '🌅' })
  avatarEmoji?: string;

  @ApiProperty({ description: 'Brand accent color', required: false, example: '#FF3BFF' })
  accent?: string;

  @ApiProperty({ description: 'Social media links', type: SocialsDto })
  socials!: SocialsDto;

  @ApiProperty({
    description: 'Custom links (Linktree-style)',
    type: [CustomLinkDto],
    example: [{ label: 'My Lightroom workflow (free)', url: 'https://example.com/workflow' }],
  })
  links!: CustomLinkDto[];

  @ApiProperty({
    description: 'Featured product IDs',
    type: [String],
    example: ['p1', 'p6'],
  })
  featuredProductIds!: string[];
}
