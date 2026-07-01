import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Query params for GET /orders.
 *
 * `creatorId` is optional — filters orders by product creator.
 * Pagination is optional with defaults (page=1, limit=20).
 *
 * Source: BE-018 — Orders Read API.
 */
export class OrdersListQueryDto {
  @ApiProperty({
    description: 'Filter by creator user ID (UUID)',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  creatorId?: string;

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
