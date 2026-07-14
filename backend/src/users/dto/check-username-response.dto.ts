import { ApiProperty } from '@nestjs/swagger';

/**
 * Response for GET /users/check-username.
 *
 * Source: BE-024 — Username Availability API.
 */
export class CheckUsernameResponseDto {
  @ApiProperty({
    description: 'The username that was checked',
    example: 'maya.shoots',
  })
  username!: string;

  @ApiProperty({
    description: 'Whether the username is available',
    example: false,
  })
  available!: boolean;
}
