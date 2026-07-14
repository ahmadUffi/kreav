import { ApiProperty } from '@nestjs/swagger';

/**
 * Response for GET /users/me and PATCH /users/me.
 *
 * Includes all User model fields plus the BE-022 profile extensions.
 * Monetary values use the DecimalToStringInterceptor convention.
 *
 * Source: BE-022 — Creator Profile API.
 */
export class ProfileResponseDto {
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
    description: 'Username',
    required: false,
    example: 'maya.shoots',
  })
  username?: string;

  @ApiProperty({
    description: 'Country',
    required: false,
    example: 'Indonesia',
  })
  country?: string;

  @ApiProperty({
    description: 'Short bio / description',
    required: false,
    example: 'Photographer & preset maker from Jakarta.',
  })
  bio?: string;

  @ApiProperty({
    description: 'Avatar emoji (stand-in for profile photo)',
    required: false,
    example: '🌅',
  })
  avatarEmoji?: string;

  @ApiProperty({
    description: 'Brand accent color (hex)',
    required: false,
    example: '#FF3BFF',
  })
  accent?: string;

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
