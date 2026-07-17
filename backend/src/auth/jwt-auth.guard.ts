import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthService } from './auth.service';

/** JWT payload shape attached to the request as `req.user`. */
export interface AuthUser {
  /** User ID (UUID) — JWT `sub`. */
  userId: string;
  /** User role: CREATOR | BUYER | ADMIN. */
  role: string;
  /** Email at token-issue time (informational). */
  email?: string;
  /** JWT ID — used for revocation. */
  jti?: string;
}

interface JwtPayload {
  sub: string;
  role: string;
  email?: string;
  jti?: string;
}

/**
 * JwtAuthGuard — verifies `Authorization: Bearer <token>` and attaches the
 * decoded identity to `req.user` (see AuthUser).
 *
 * Identity comes from the token, NEVER from query/body params (Roadmap Fase 1:
 * no more `?userId=` / `?creatorId=` identity).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.jti && this.auth.isTokenRevoked(payload.jti)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    req.user = { userId: payload.sub, role: payload.role, email: payload.email, jti: payload.jti };
    return true;
  }
}
