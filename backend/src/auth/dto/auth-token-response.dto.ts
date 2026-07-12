import { ApiProperty } from '@nestjs/swagger';
import { RegisterResponseDto } from './register-response.dto';

/**
 * Session-token response — returned by POST /auth/verify and (with the
 * created profile) by POST /auth/register.
 *
 * The token is a JWT: `Authorization: Bearer <token>` on all user-scoped
 * endpoints. Payload: { sub: userId, role, email }.
 */
export class AuthTokenResponseDto {
  @ApiProperty({
    description: 'Session JWT — send as `Authorization: Bearer <token>`',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  token!: string;

  @ApiProperty({ description: 'Authenticated user profile', type: RegisterResponseDto })
  user!: RegisterResponseDto;
}

/** Response for POST /auth/register — created profile + session token. */
export class RegisterWithTokenResponseDto extends RegisterResponseDto {
  @ApiProperty({
    description: 'Session JWT — send as `Authorization: Bearer <token>`',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  token!: string;
}
