import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Body for POST /products.
 *
 * `priceUsd` is a STRING, never a number — accepting a JS number here would
 * lose precision past 2^53 and invite float rounding in money. The regex
 * enforces a non-negative decimal with 0–2 fractional digits ("10", "9.5",
 * "9.50" all valid). The DB column is Decimal(18,2).
 *
 * `fileUrl` is the digital product download/access link (required).
 *
 * Source: Kreav Backend PRD v3 — §9 Product APIs.
 */
export class CreateProductDto {
  @ApiProperty({
    description: 'Product title',
    example: 'Lightroom Sunset Presets',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'title must not be empty' })
  title!: string;

  @ApiProperty({
    description: 'Product description',
    required: false,
    example: '12 warm, film-inspired Lightroom presets tuned for golden-hour portraits.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Download or access URL for the digital product (public for demo)',
    required: true,
    example: 'https://drive.google.com/file/d/abc123/view',
  })
  @IsString()
  @IsNotEmpty({ message: 'fileUrl must not be empty' })
  fileUrl!: string;

  @ApiProperty({
    description: 'Price in USD (string with 0-2 decimal places)',
    required: true,
    example: '18.00',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'priceUsd must be a decimal string with up to 2 fractional digits (e.g. "10.00")',
  })
  priceUsd!: string;

  @ApiProperty({
    description: 'Creator user ID (UUID)',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsUUID()
  creatorId!: string;
}
