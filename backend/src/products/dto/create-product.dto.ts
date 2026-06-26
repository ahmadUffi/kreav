import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

/**
 * Body for POST /products.
 *
 * `priceUsd` is a STRING, never a number — accepting a JS number here would
 * lose precision past 2^53 and invite float rounding in money. The regex
 * enforces a non-negative decimal with 0–2 fractional digits ("10", "9.5",
 * "9.50" all valid). The DB column is Decimal(18,2).
 *
 * Source: Kreav Backend PRD v3 — §9 Product APIs.
 */
export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'title must not be empty' })
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'priceUsd must be a decimal string with up to 2 fractional digits (e.g. "10.00")',
  })
  priceUsd!: string;

  @IsString()
  @IsUUID()
  creatorId!: string;
}
