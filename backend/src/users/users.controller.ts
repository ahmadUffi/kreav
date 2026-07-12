import { Body, Controller, Get, Logger, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  UpdateProfileDto,
  ProfileResponseDto,
  CheckUsernameQueryDto,
  CheckUsernameResponseDto,
  PublicProfileResponseDto,
} from './dto';

/**
 * UsersController — BE-022 + Fase 1 (token-scoped identity).
 *
 *   GET   /users/me  — get current user profile        (JWT)
 *   PATCH /users/me  — update profile fields           (JWT)
 *   GET   /users/check-username    — availability      (public)
 *   GET   /users/:username/profile — public profile    (public)
 *
 * Identity comes from the session JWT (JwtAuthGuard) — never from query params.
 *
 * Source: BE-022 — Creator Profile API + ROADMAP Fase 1.
 */
@ApiTags('Users')
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly users: UsersService) {}

  /**
   * GET /users/me — profile of the authenticated user.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Returns the full profile for the authenticated user (identity from the ' +
      'session JWT). Includes all BE-022 profile fields (username, country, bio, ' +
      'avatar emoji, accent).',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid bearer token' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProfile(@CurrentUser() user: AuthUser): Promise<ProfileResponseDto> {
    this.logger.log(`GET /users/me user=${user.userId}`);
    return this.users.getProfile(user.userId);
  }

  /**
   * PATCH /users/me — update profile of the authenticated user.
   */
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Update profile',
    description:
      'Updates the authenticated user profile. All fields are optional — partial ' +
      'updates supported. Username uniqueness is enforced — returns 409 if the ' +
      'username is already taken. Username format: lowercase letters, numbers, ' +
      'dots, underscores, hyphens. 3–30 characters.',
  })
  @ApiBody({
    type: UpdateProfileDto,
    description: 'Profile fields to update (all optional)',
    examples: {
      full: {
        summary: 'Full profile update',
        value: {
          name: 'Maya Tan',
          username: 'maya.shoots',
          country: 'Indonesia',
          bio: 'Photographer & preset maker from Jakarta.',
          avatarEmoji: '🌅',
          accent: '#FF3BFF',
        },
      },
      partial: {
        summary: 'Partial — just the bio',
        value: { bio: 'Updated bio text.' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing/invalid bearer token' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Username already taken' })
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    this.logger.log(`PATCH /users/me user=${user.userId}`);
    return this.users.updateProfile(user.userId, dto);
  }

  // ── BE-024: Username Check ───────────────────────────────────────────────

  /**
   * GET /users/check-username?username=<value>
   *
   * Checks whether a username is available for registration.
   */
  @Get('check-username')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({
    summary: 'Check username availability',
    description:
      'Checks whether a username is available. ' +
      'Returns { username, available: boolean }. ' +
      'Username format: lowercase letters, numbers, dots, underscores, hyphens. 3–30 characters.',
  })
  @ApiQuery({
    name: 'username',
    description: 'Username to check',
    required: true,
    example: 'maya.shoots',
  })
  @ApiResponse({
    status: 200,
    description: 'Username availability check result',
    type: CheckUsernameResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid username format' })
  async checkUsername(@Query() query: CheckUsernameQueryDto): Promise<CheckUsernameResponseDto> {
    this.logger.log(`GET /users/check-username?username=${query.username}`);
    return this.users.checkUsername(query.username);
  }

  // ── BE-023: Public Profile ────────────────────────────────────────────────

  /**
   * GET /users/:username/profile — public creator profile.
   *
   * Returns basic profile info + creator's products. No email or wallet details.
   */
  @Get(':username/profile')
  @ApiOperation({
    summary: 'Get public creator profile',
    description:
      'Returns a public creator profile by username. ' +
      'Includes display name, bio, country, avatar emoji, accent, ' +
      "and the creator's products. " +
      'No email or wallet details are exposed. ' +
      'Throws 404 if the username is not found.',
  })
  @ApiParam({
    name: 'username',
    description: 'Creator username',
    required: true,
    example: 'maya.shoots',
  })
  @ApiResponse({
    status: 200,
    description: 'Public profile retrieved successfully',
    type: PublicProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  async getPublicProfile(@Param('username') username: string): Promise<PublicProfileResponseDto> {
    this.logger.log(`GET /users/${username}/profile`);
    return this.users.getPublicProfile(username);
  }
}
