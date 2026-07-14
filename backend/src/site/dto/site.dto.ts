import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * A single custom link (Linktree-style) on the mini-site.
 */
class CustomLinkDto {
  @ApiProperty({ description: 'Link label', example: 'My Lightroom workflow (free)' })
  @IsString()
  label!: string;

  @ApiProperty({ description: 'Link URL', example: 'https://example.com/workflow' })
  @IsString()
  url!: string;
}

/**
 * Social media links for a creator mini-site.
 */
class SocialsDto {
  @ApiProperty({ required: false, example: 'maya.shoots' })
  @IsOptional()
  @IsString()
  instagram?: string;

  @ApiProperty({ required: false, example: 'mayashoots' })
  @IsOptional()
  @IsString()
  x?: string;

  @ApiProperty({ required: false, example: 'maya.shoots' })
  @IsOptional()
  @IsString()
  tiktok?: string;

  @ApiProperty({ required: false, example: '@mayashoots' })
  @IsOptional()
  @IsString()
  youtube?: string;
}

/**
 * Request/response body for GET/PUT /users/me/site.
 *
 * The PUT replaces the entire mini-site configuration atomically.
 *
 * NOTE: every field carries a class-validator decorator — with the global
 * ValidationPipe `whitelist: true`, a property with ONLY `@ApiProperty` (no
 * validator) is stripped from the body, which previously wiped socials/links/
 * featuredProductIds on save. Keep validators here.
 *
 * Source: BE-025 — Creator Mini-Site API.
 */
export class SiteDto {
  @ApiProperty({ description: 'Display name', example: 'Maya Tan' })
  @IsString()
  displayName!: string;

  @ApiProperty({ description: 'Username', example: 'maya.shoots' })
  @IsString()
  username!: string;

  @ApiProperty({
    description: 'Short bio',
    required: false,
    example: 'Photographer & preset maker from Jakarta.',
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({ description: 'Avatar emoji', required: false, example: '🌅' })
  @IsOptional()
  @IsString()
  avatarEmoji?: string;

  @ApiProperty({ description: 'Brand accent color', required: false, example: '#FF3BFF' })
  @IsOptional()
  @IsString()
  accent?: string;

  @ApiProperty({ description: 'Social media links', type: SocialsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SocialsDto)
  socials!: SocialsDto;

  @ApiProperty({
    description: 'Custom links (Linktree-style)',
    type: [CustomLinkDto],
    example: [{ label: 'My Lightroom workflow (free)', url: 'https://example.com/workflow' }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomLinkDto)
  links!: CustomLinkDto[];

  @ApiProperty({
    description: 'Featured product IDs',
    type: [String],
    example: ['p1', 'p6'],
  })
  @IsArray()
  @IsString({ each: true })
  featuredProductIds!: string[];
}
