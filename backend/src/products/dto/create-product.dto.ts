import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * A single revenue-split collaborator supplied at product-creation time.
 *
 * `walletAddress` is a Stellar public key (starts with `G`, base32, 56 chars).
 * `revenuePercentage` is a STRING decimal (Decimal(5,2), 0–2 fractional digits)
 * so we never lose money-split precision to float. The service validates that
 * every collaborator list sums to exactly 100.00.
 */
export class CreateCollaboratorDto {
  @ApiProperty({
    description: 'Stellar public key of the collaborator (revenue recipient)',
    example: 'GCHOG4QF27OG5WHBY4AIBGEI4LSOTCY3Y4VX22AUNLHTDBWMLZW5OBU3',
  })
  @IsString()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'walletAddress must be a valid Stellar public key (G... 56 chars)',
  })
  walletAddress!: string;

  @ApiProperty({
    description: 'Free-text role label (Author, Illustrator, Editor, ...)',
    example: 'Author',
  })
  @IsString()
  @IsNotEmpty({ message: 'role must not be empty' })
  role!: string;

  @ApiProperty({
    description: 'Revenue share percent (string, 0–2 decimals). List must sum to 100.',
    example: '50.00',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'revenuePercentage must be a decimal string with up to 2 fractional digits',
  })
  revenuePercentage!: string;
}

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
 * `collaborators` is OPTIONAL — the revenue-split recipient list. When omitted,
 * the product creator is auto-added as the sole collaborator at 100% (their
 * connected wallet), so every product is settleable out of the box. When
 * provided, the shares must sum to exactly 100.00.
 *
 * Source: Kreav Backend PRD v3 — §9 Product APIs; v3.1 §19 Collaborative Split.
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
    description: 'Price in USD (string with 0-2 decimal places, minimum $0.01)',
    required: true,
    example: '18.00',
  })
  @IsString()
  @Matches(/^(?!0(\.0{1,2})?$)\d+(\.\d{1,2})?$/, {
    message:
      'priceUsd must be a positive decimal string with up to 2 fractional digits (e.g. "10.00"), minimum $0.01',
  })
  priceUsd!: string;

  @ApiPropertyOptional({
    description:
      'Optional revenue-split collaborators. If omitted, the creator becomes the ' +
      'sole collaborator at 100%. If provided, shares must sum to exactly 100.00.',
    type: [CreateCollaboratorDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCollaboratorDto)
  collaborators?: CreateCollaboratorDto[];
}
