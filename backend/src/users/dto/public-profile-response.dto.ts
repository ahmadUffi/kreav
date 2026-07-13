import { ApiProperty } from '@nestjs/swagger';

/**
 * A product shown in the public creator profile.
 */
class PublicProfileProductDto {
  @ApiProperty({ description: 'Product ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ description: 'Product title', example: 'Lightroom Sunset Presets' })
  title!: string;

  @ApiProperty({ description: 'Product price (USD)', example: '18.00' })
  priceUsd!: string;

  @ApiProperty({ description: 'Product category', example: 'Preset' })
  category?: string;
}

/**
 * Response for GET /users/:username/profile.
 *
 * Public profile — no email, no wallet details.
 * Includes basic profile info + creator's products.
 *
 * Source: BE-023 — Creator Public Profile API.
 */
export class PublicProfileResponseDto {
  @ApiProperty({
    description: 'Username',
    example: 'maya.shoots',
  })
  username!: string;

  @ApiProperty({
    description: 'Display name',
    example: 'Maya Tan',
  })
  displayName!: string;

  @ApiProperty({
    description: 'Short bio / description',
    required: false,
    example: 'Photographer & preset maker from Jakarta.',
  })
  bio?: string;

  @ApiProperty({
    description: 'Country',
    required: false,
    example: 'Indonesia',
  })
  country?: string;

  @ApiProperty({
    description: 'Avatar emoji',
    required: false,
    example: '🌅',
  })
  avatarEmoji?: string;

  @ApiProperty({
    description: 'Brand accent color',
    required: false,
    example: '#FF3BFF',
  })
  accent?: string;

  @ApiProperty({
    description: "Creator's featured products (or recent active ones as fallback)",
    type: [PublicProfileProductDto],
  })
  products!: PublicProfileProductDto[];

  @ApiProperty({
    description: 'Social media handles',
    required: false,
    example: { instagram: 'maya.shoots' },
  })
  socials?: { instagram?: string; x?: string; tiktok?: string; youtube?: string };

  @ApiProperty({
    description: 'Custom links (Linktree-style)',
    type: 'array',
    required: false,
    example: [{ label: 'My workflow', url: 'https://example.com' }],
  })
  links?: { label: string; url: string }[];
}
