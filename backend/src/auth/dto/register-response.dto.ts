import { ApiProperty } from '@nestjs/swagger';

/**
 * Response for POST /auth/register.
 *
 * Returns the created user profile. Monetary fields use the
 * DecimalToStringInterceptor convention — money is always a string.
 *
 * Source: BE-021 — User Registration API.
 */
export class RegisterResponseDto {
  @ApiProperty({
    description: 'Unique user ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Email address',
    example: 'maya@example.com',
  })
  email!: string;

  @ApiProperty({
    description: 'Display name',
    example: 'Maya Tan',
  })
  name!: string;

  @ApiProperty({
    description: 'User role',
    example: 'CREATOR',
  })
  role!: string;

  @ApiProperty({
    description: 'ISO-8601 timestamp of when the user was created',
    example: '2026-06-30T12:00:00.000Z',
  })
  createdAt!: string;
}
