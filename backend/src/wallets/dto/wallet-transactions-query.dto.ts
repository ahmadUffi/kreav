import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Query params for GET /wallet/transactions.
 *
 * Fase 1: the wallet address is resolved from the session JWT server-side —
 * only pagination remains. Source: Kreav Backend PRD v3 — §9 Wallet APIs.
 */
export class WalletTransactionsQueryDto {
  @ApiProperty({
    description: 'Page number (1-indexed)',
    required: false,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiProperty({
    description: 'Items per page',
    required: false,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
