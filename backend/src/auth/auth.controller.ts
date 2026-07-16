import { Body, Controller, Get, HttpCode, Logger, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiCreatedResponse,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  RegisterWithTokenResponseDto,
  ChallengeRequestDto,
  ChallengeResponseDto,
  VerifyRequestDto,
  AuthTokenResponseDto,
} from './dto';
import { JwtAuthGuard, type AuthUser } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';

/**
 * AuthController — BE-021 + Fase 1 (SEP-10 wallet auth).
 *
 *   POST /auth/register   — register a new user (returns session JWT)
 *   POST /auth/challenge  — SEP-10 challenge tx for a wallet address
 *   POST /auth/verify     — verify signed challenge → session JWT
 *
 * No password. Creator identity is by Stellar wallet (SEP-10, non-custodial);
 * registration itself starts a session (register = logged in).
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly auth: AuthService) {}

  /**
   * POST /auth/register — create a new user account + session token.
   */
  @Post('register')
  @HttpCode(201)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a new user account with email, display name, and role, and returns ' +
      'a session JWT (registration starts a session). No password — returning creators ' +
      'log in with their Stellar wallet via /auth/challenge + /auth/verify. ' +
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
    description: 'User registered successfully (includes session JWT)',
    type: RegisterWithTokenResponseDto,
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
  async register(@Body() dto: RegisterDto): Promise<RegisterWithTokenResponseDto> {
    this.logger.log(`POST /auth/register email=${dto.email} role=${dto.role}`);
    return this.auth.register(dto);
  }

  /**
   * GET /auth/wallet-status — is this wallet already linked to an account?
   * Lets the client decide login-vs-onboard before any SEP-10 signature.
   */
  @Get('wallet-status')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({
    summary: 'Check whether a wallet is registered',
    description:
      'Returns { registered: boolean } for a Stellar wallet address. Used to route ' +
      'a returning wallet to SEP-10 login and a new wallet to creator onboarding.',
  })
  @ApiQuery({ name: 'address', description: 'Stellar public key (G...)', required: true })
  @ApiResponse({
    status: 200,
    description: 'Registration status',
    schema: { example: { registered: true } },
  })
  async walletStatus(@Query('address') address: string): Promise<{ registered: boolean }> {
    return this.auth.walletStatus(address ?? '');
  }

  /**
   * POST /auth/challenge — request a SEP-10 challenge for a wallet.
   */
  @Post('challenge')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary: 'Request a SEP-10 login challenge',
    description:
      'Builds a SEP-10 challenge transaction for the given Stellar wallet address. ' +
      'Sign it client-side (Freighter signTransaction on Testnet), then POST the ' +
      'signed XDR to /auth/verify to receive a session JWT.',
  })
  @ApiBody({ type: ChallengeRequestDto })
  @ApiResponse({ status: 200, description: 'Challenge built', type: ChallengeResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid wallet address format' })
  challenge(@Body() dto: ChallengeRequestDto): ChallengeResponseDto {
    this.logger.log(`POST /auth/challenge wallet=${dto.walletAddress.slice(0, 8)}...`);
    return this.auth.buildChallenge(dto.walletAddress);
  }

  /**
   * POST /auth/verify — verify a signed SEP-10 challenge → session JWT.
   */
  @Post('verify')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary: 'Verify a signed SEP-10 challenge',
    description:
      'Verifies the signed challenge transaction (server signature, timebounds, ' +
      'client wallet signature), resolves the wallet to its Kreav account, and ' +
      'returns a session JWT. 401 if verification fails or the wallet is not ' +
      'connected to any account.',
  })
  @ApiBody({ type: VerifyRequestDto })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthTokenResponseDto })
  @ApiResponse({ status: 401, description: 'Challenge verification failed / unknown wallet' })
  async verify(@Body() dto: VerifyRequestDto): Promise<AuthTokenResponseDto> {
    this.logger.log('POST /auth/verify');
    return this.auth.verifyChallenge(dto.transaction);
  }

  /**
   * POST /auth/logout — revoke the current session token.
   */
  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout / revoke current session token',
    description:
      'Revokes the current session JWT. After this call, the token can no longer ' +
      'be used to access protected endpoints. The client should discard the token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Token revoked',
    schema: { example: { success: true } },
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid bearer token' })
  logout(@CurrentUser() user: AuthUser): { success: boolean } {
    if (user.jti) {
      this.auth.revokeToken(user.jti);
    }
    return { success: true };
  }
}
