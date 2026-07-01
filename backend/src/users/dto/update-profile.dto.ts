import { IsOptional, IsString, Matches, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Body for PATCH /users/me.
 *
 * All fields are optional — partial updates supported.
 * Username validation: lowercase letters, numbers, dots, underscores, hyphens.
 *
 * Source: BE-022 — Creator Profile API.
 */
export class UpdateProfileDto {
  @ApiProperty({
    description: 'Display name',
    required: false,
    example: 'Maya Tan',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description:
      'Username — lowercase letters, numbers, dots, underscores, hyphens. 3–30 characters.',
    required: false,
    example: 'maya.shoots',
    pattern: '^[a-z0-9._-]{3,30}$',
  })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(30, { message: 'Username must be at most 30 characters' })
  @Matches(/^[a-z0-9._-]+$/, {
    message:
      'Username can only contain lowercase letters, numbers, dots, underscores, and hyphens',
  })
  username?: string;

  @ApiProperty({
    description: 'Country',
    required: false,
    example: 'Indonesia',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({
    description: 'Short bio / description',
    required: false,
    example: 'Photographer & preset maker from Jakarta.',
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({
    description: 'Avatar emoji (stand-in for profile photo)',
    required: false,
    example: '🌅',
  })
  @IsOptional()
  @IsString()
  avatarEmoji?: string;

  @ApiProperty({
    description: 'Brand accent color (hex)',
    required: false,
    example: '#FF3BFF',
  })
  @IsOptional()
  @IsString()
  accent?: string;
}
