import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from './jwt-auth.guard';

/**
 * @CurrentUser() — extracts the authenticated identity that JwtAuthGuard
 * attached to the request. Only meaningful on routes guarded by JwtAuthGuard.
 *
 *   @UseGuards(JwtAuthGuard)
 *   @Get('me')
 *   me(@CurrentUser() user: AuthUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    // Guard guarantees presence; the fallback keeps types honest if misused.
    return req.user ?? { userId: '', role: '' };
  },
);
