import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiCreatedResponse,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, RegisterResponseDto } from './dto';

/**
 * AuthController — BE-021.
 *
 *   POST /auth/register  — register a new user (email + name + role)
 *
 * Email-only registration. No password. Identity is by Stellar wallet.
 * Source: Kreav Backend PRD v3 — §9 User APIs (BE-021).
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly auth: AuthService) {}

  /**
   * POST /auth/register — create a new user account.
   *
   * Creates a user with email, display name, and role. Returns 201 with the
   * created profile. Throws 409 if the email is already registered.
   */
  @Post('register')
  @HttpCode(201)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a new user account with email, display name, and role. ' +
      'No password required — identity is by Stellar wallet (non-custodial). ' +
      'Returns 409 Conflict if the email is already registered.',
  })
  @ApiBody({
    type: RegisterDto,
    description: 'Registration payload',
    examples: {
      creator: {
        summary: '🇮🇩 Creator registration',
        value: { email: 'maya@example.com', name: 'Maya Tan', role: 'CREATOR' },
      },
      buyer: {
        summary: '🇵🇭 Buyer registration',
        value: { email: 'juan@example.com', name: 'Juan Santos', role: 'BUYER' },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'User registered successfully',
    type: RegisterResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — invalid email, empty name, or invalid role',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already registered',
    schema: {
      example: {
        message: 'Email maya@example.com is already registered',
        error: 'Conflict',
        statusCode: 409,
      },
    },
  })
  async register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    this.logger.log(`POST /auth/register email=${dto.email} role=${dto.role}`);
    return this.auth.register(dto);
  }
}
