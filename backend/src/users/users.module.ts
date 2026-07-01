import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * Users Module — BE-022.
 *
 * Responsibilities: creator profile read and update.
 *
 * Endpoints:
 *   GET   /users/me  — get current user profile
 *   PATCH /users/me  — update profile fields
 *
 * Source: Kreav Backend PRD v3 — §6 User Module + BE-022.
 */
@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
