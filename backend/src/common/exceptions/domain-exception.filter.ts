import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';
import { DomainException } from './domain.exception';

/**
 * Global exception filter — BE-012 (audit #12).
 *
 * Catches every exception thrown during request processing and returns a
 * consistent JSON shape:
 *
 *   { code: "ERROR_CODE", message: "...", statusCode: 4xx, timestamp: "..." }
 *
 * Layers:
 *   1. DomainException — uses its structured code + message
 *   2. HttpException (NestJS built-in, e.g. NotFoundException) — passthrough
 *   3. Unknown errors — sanitized 500 with no stack leak
 *
 * Registered globally in main.ts via app.useGlobalFilters().
 *
 * Source: Kreav Security PRD §5 — audit #12 (domain exception hierarchy).
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const timestamp = new Date().toISOString();

    // ── 1. DomainException (our own) ───────────────────────────────────
    if (exception instanceof DomainException) {
      const body = exception.getResponse() as Record<string, unknown>;
      response.status(exception.getStatus()).json({
        code: body.code ?? 'DOMAIN_ERROR',
        message: body.message ?? 'Domain error',
        statusCode: exception.getStatus(),
        timestamp,
      });
      return;
    }

    // ── 2. NestJS HttpException (NotFoundException, BadRequest, etc.) ──
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as Record<string, unknown>)?.message ?? exception.message);

      response.status(status).json({
        code: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
        message,
        statusCode: status,
        timestamp,
      });
      return;
    }

    // ── 3. Unknown / 500 ──────────────────────────────────────────────
    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : exception,
    );

    response.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      statusCode: 500,
      timestamp,
    });
  }
}
