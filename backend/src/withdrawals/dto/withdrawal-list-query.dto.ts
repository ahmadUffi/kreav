import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Query params for GET /withdrawals.
 *
 * `address` is required (Stellar wallet address). Pagination is optional.
 * Source: Kreav Backend PRD v3 — §9 Withdrawal APIs (BE-009).
 */
export class WithdrawalListQueryDto {
  @ApiProperty({
    description: 'Stellar wallet public key (G...) to query withdrawals for',
    example: 'GCHOG4QF27OG5WHBY4AIBGEI4LSOTCY3Y4VX22AUNLHTDBWMLZW5OBU3',
    required: true,
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
