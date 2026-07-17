import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from './jwt-auth.guard';

/**
 * @CurrentUser() — extracts the authenticated identity that JwtAuthGuard
 * attached to the request. Only meaningful on routes guarded by JwtAuthGuard.
 *
 *   @UseGuards(JwtAuthGuard)
 *   @Get('me')
 *   me(@CurrentUser() user: AuthUser) { ... }
 *
 * Throws UnauthorizedException when used on an unguarded route — preventing
 * silent access with an empty user when the guard is accidentally omitted.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (!req.user) {
      throw new UnauthorizedException('No authenticated user — guard missing on this route');
    }
    return req.user;
  },
);
