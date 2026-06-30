import { IsOptional, IsInt, IsString, Matches, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Query params for GET /wallet/transactions.
 *
 * `address` is required (Stellar public key). Pagination is optional.
 * Source: Kreav Backend PRD v3 — §9 Wallet APIs.
 */
export class WalletTransactionsQueryDto {
  @ApiProperty({
    description: 'Stellar wallet public key (G...) to query transactions for',
    example: 'GDA2SQ2PHWIER57TDXKLBSOD3IT4GTAHK5RV2H27LJZAXDBWQ6KYJ72B',
    pattern: '^G[A-Z2-7]{55}$',
  })
  @IsString()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'address must be a valid Stellar public key starting with G',
  })
  address!: string;

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
