import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

/**
 * Body for POST /auth/register.
 *
 * Email-only registration — no password. Identity is by Stellar wallet (non-custodial).
 * Username and country are deferred to profile completion (BE-022).
 *
 * Source: BE-021 — User Registration API.
 */
export class RegisterDto {
  @ApiProperty({
    description: 'Email address — used for notifications and login',
    example: 'maya@example.com',
    required: true,
  })
  @IsEmail({}, { message: 'Must be a valid email address' })
  email!: string;

  @ApiProperty({
    description: 'Display name / full name',
    example: 'Maya Tan',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Name must not be empty' })
  name!: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    example: 'CREATOR',
    required: false,
    default: 'BUYER',
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be CREATOR, BUYER, or ADMIN' })
  role: UserRole = UserRole.BUYER;
}
