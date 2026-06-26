import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Pagination + optional creator filter for GET /products.
 * Query params arrive as strings; `@Type(() => Number)` coerces them so the
 * `@IsInt` / `@Min` / `@Max` validators see real numbers.
 *
 * Source: Kreav Backend PRD v3 — §9 Product APIs.
 */
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsString()
  @IsUUID()
  creatorId?: string;
}
