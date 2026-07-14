import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Query params for GET /analytics.
 *
 * `creatorId` is required to scope analytics to a specific creator.
 *
 * Source: BE-019 — Dashboard Analytics API.
 */
export class AnalyticsQueryDto {
  @ApiProperty({
    description: 'Creator user ID (UUID) to scope analytics to',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsUUID()
  creatorId!: string;
}
