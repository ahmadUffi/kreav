import { ApiProperty } from '@nestjs/swagger';

/**
 * A product shown in the public creator profile.
 * BE-027: now includes emoji, accent, category for frontend cover tile rendering.
 */
class PublicProfileProductDto {
  @ApiProperty({ description: 'Product ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ description: 'Product title', example: 'Lightroom Sunset Presets' })
  title!: string;

  @ApiProperty({ description: 'Product price (USD)', example: '18.00' })
  priceUsd!: string;

  @ApiProperty({ description: 'Product category', example: 'Preset', required: false })
  category?: string;

  @ApiProperty({ description: 'Cover tile emoji', example: '🌅', required: false })
  emoji?: string;

  @ApiProperty({ description: 'Cover tile accent color', example: '#FF3BFF', required: false })
  accent?: string;
}

/**
 * A social media link on the public mini-site.
 * BE-027: added to public profile response.
 */
class PublicProfileSocialDto {
  @ApiProperty({ description: 'Platform identifier', example: 'INSTAGRAM' })
  platform!: string;

  @ApiProperty({ description: 'Handle / username on that platform', example: 'maya.shoots' })
  handle!: string;
}

/**
 * A custom link (Linktree-style) on the public mini-site.
 * BE-027: added to public profile response.
 */
class PublicProfileLinkDto {
  @ApiProperty({ description: 'Link label', example: 'My Portfolio' })
  label!: string;

  @ApiProperty({ description: 'URL', example: 'https://maya.com' })
  url!: string;

  @ApiProperty({ description: 'Display order (ascending)', example: 0 })
  sortOrder!: number;
}

/**
 * A featured product on the public mini-site.
 * BE-027: added to public profile response.
 */
class PublicProfileFeaturedProductDto {
  @ApiProperty({ description: 'Product ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ description: 'Product title', example: 'Lightroom Sunset Presets' })
  title!: string;

  @ApiProperty({ description: 'Product price (USD)', example: '18.00' })
  priceUsd!: string;

  @ApiProperty({ description: 'Cover tile emoji', example: '🌅', required: false })
  emoji?: string;

  @ApiProperty({ description: 'Cover tile accent color', example: '#FF3BFF', required: false })
  accent?: string;

  @ApiProperty({ description: 'Display order on the mini-site (ascending)', example: 0 })
  sortOrder!: number;
}

/**
 * Response for GET /users/:username/profile.
 *
 * Public profile — no email, no wallet details.
 * BE-027: extended with socials, links, featuredProducts so /u/[username]
 * can fully render without extra API calls.
 *
 * Source: BE-023 — Creator Public Profile API; BE-027 — Product UI Fields.
 */
export class PublicProfileResponseDto {
  @ApiProperty({ description: 'Username', example: 'maya.shoots' })
  username!: string;

  @ApiProperty({ description: 'Display name', example: 'Maya Tan' })
  displayName!: string;

  @ApiProperty({
    description: 'Short bio',
    required: false,
    example: 'Photographer & preset maker from Jakarta.',
  })
  bio?: string;

  @ApiProperty({ description: 'Country', required: false, example: 'Indonesia' })
  country?: string;

  @ApiProperty({ description: 'Avatar emoji', required: false, example: '🌅' })
  avatarEmoji?: string;

  @ApiProperty({ description: 'Brand accent color', required: false, example: '#FF3BFF' })
  accent?: string;

  @ApiProperty({ description: "All creator's products", type: [PublicProfileProductDto] })
  products!: PublicProfileProductDto[];

  @ApiProperty({ description: 'Social media links', type: [PublicProfileSocialDto] })
  socials!: PublicProfileSocialDto[];

  @ApiProperty({ description: 'Custom links (Linktree-style)', type: [PublicProfileLinkDto] })
  links!: PublicProfileLinkDto[];

  @ApiProperty({
    description: 'Featured products on mini-site',
    type: [PublicProfileFeaturedProductDto],
  })
  featuredProducts!: PublicProfileFeaturedProductDto[];
}
