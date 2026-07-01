import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SiteController } from './site.controller';
import { SiteService } from './site.service';

/**
 * Site Module — BE-025.
 *
 * Responsibilities: creator mini-site configuration (Linktree-style page).
 *
 * Endpoints:
 *   GET  /users/me/site  — get mini-site config (socials, links, featured products)
 *   PUT  /users/me/site  — atomically replace mini-site config
 *
 * Source: BE-025 — Creator Mini-Site API.
 */
@Module({
  imports: [PrismaModule],
  controllers: [SiteController],
  providers: [SiteService],
  exports: [SiteService],
})
export class SiteModule {}
