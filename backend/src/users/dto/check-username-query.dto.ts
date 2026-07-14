import { IsString, Matches, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Query params for GET /users/check-username.
 *
 * Source: BE-024 — Username Availability API.
 */
export class CheckUsernameQueryDto {
  @ApiProperty({
    description:
      'Username to check — lowercase letters, numbers, dots, underscores, hyphens. 3–30 characters.',
    required: true,
    example: 'maya.shoots',
    pattern: '^[a-z0-9._-]{3,30}$',
  })
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(30, { message: 'Username must be at most 30 characters' })
  @Matches(/^[a-z0-9._-]+$/, {
    message: 'Username can only contain lowercase letters, numbers, dots, underscores, and hyphens',
  })
  username!: string;
}
