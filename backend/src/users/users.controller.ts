import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  UpdateProfileDto,
  ProfileResponseDto,
  CheckUsernameQueryDto,
  CheckUsernameResponseDto,
  PublicProfileResponseDto,
} from './dto';

/**
 * UsersController — BE-022.
 *
 *   GET  /users/me  — get current user profile
 *   PATCH /users/me — update profile fields
 *
 * No auth middleware for MVP — uses `?userId=` query param.
 *
 * Source: BE-022 — Creator Profile API.
 */
@ApiTags('Users')
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly users: UsersService) {}

  /**
   * GET /users/me?userId=<uuid>
   *
   * Returns the full profile for the given user ID.
   */
  @Get('me')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Returns the full profile for the authenticated user. ' +
      'No auth middleware for MVP — uses ?userId= query param. ' +
      'Includes all BE-022 profile fields (username, country, bio, avatar emoji, accent).',
  })
  @ApiQuery({
    name: 'userId',
    description: 'User ID (UUID)',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid userId format' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProfile(
    @Query('userId') userId: string,
  ): Promise<ProfileResponseDto> {
    if (!userId) {
      throw new NotFoundException('userId query parameter is required');
    }
    this.logger.log(`GET /users/me?userId=${userId}`);
    return this.users.getProfile(userId);
  }

  /**
   * PATCH /users/me?userId=<uuid>
   *
   * Updates profile fields. All fields are optional — partial updates supported.
   * Username uniqueness is enforced (409 Conflict on duplicate).
   */
  @Patch('me')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Update profile',
    description:
      'Updates the user profile. All fields are optional — partial updates supported. ' +
      'Username uniqueness is enforced — returns 409 if the username is already taken. ' +
      'Username format: lowercase letters, numbers, dots, underscores, hyphens. 3–30 characters.',
  })
  @ApiQuery({
    name: 'userId',
    description: 'User ID (UUID)',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
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
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Username already taken' })
  async updateProfile(
    @Query('userId') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    if (!userId) {
      throw new NotFoundException('userId query parameter is required');
    }
    this.logger.log(`PATCH /users/me?userId=${userId}`);
    return this.users.updateProfile(userId, dto);
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
  async checkUsername(
    @Query() query: CheckUsernameQueryDto,
  ): Promise<CheckUsernameResponseDto> {
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
      'and the creator\'s products. ' +
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
  async getPublicProfile(
    @Param('username') username: string,
  ): Promise<PublicProfileResponseDto> {
    this.logger.log(`GET /users/${username}/profile`);
    return this.users.getPublicProfile(username);
  }
}
