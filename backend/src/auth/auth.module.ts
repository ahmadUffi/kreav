import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * Auth Module — BE-021.
 *
 * Responsibilities: user registration (email + name + role).
 * No password, no JWT, no session — identity is by Stellar wallet (non-custodial).
 *
 * Endpoints:
 *   POST /auth/register  — register a new user
 *
 * Source: Kreav Backend PRD v3 — §6 Auth Module + BE-021.
 */
@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
