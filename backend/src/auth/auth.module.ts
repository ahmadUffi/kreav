import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { StellarModule } from '../stellar/stellar.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Auth Module — BE-021 + Fase 1 (SEP-10 wallet auth + session JWT).
 *
 * Endpoints:
 *   POST /auth/register   — register (returns session JWT)
 *   POST /auth/challenge  — SEP-10 challenge for a wallet
 *   POST /auth/verify     — verify signed challenge → session JWT
 *
 * JwtModule is registered GLOBALLY here so JwtAuthGuard can be used by any
 * module via @UseGuards(JwtAuthGuard) without extra imports.
 *
 * Source: Kreav Backend PRD v3 — §6 Auth Module + ROADMAP Fase 1.
 */
@Global()
@Module({
  imports: [
    PrismaModule,
    StellarModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
