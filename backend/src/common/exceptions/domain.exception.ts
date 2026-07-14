import { HttpException } from '@nestjs/common';

/**
 * Base domain exception — all Kreav business-logic errors extend this.
 *
 * Carries a machine-readable `code` and an HTTP `status` so the global
 * exception filter can produce a consistent JSON response.
 *
 * Source: Kreav Security PRD audit #12 — Domain exception hierarchy.
 */
export class DomainException extends HttpException {
  /**
   * @param code    Machine-readable error code (e.g. "ORDER_NOT_FOUND")
   * @param message Human-readable description
   * @param status  HTTP status code (default 400)
   */
  constructor(
    public readonly code: string,
    message: string,
    status: number = 400,
  ) {
    super({ code, message, statusCode: status }, status);
    this.name = 'DomainException';
  }

  /** Convenience: factory for 404 errors. */
  static notFound(entity: string, id?: string): DomainException {
    const msg = id ? `${entity} not found: ${id}` : `${entity} not found`;
    return new DomainException(`${entity.toUpperCase().replace(/\s+/g, '_')}_NOT_FOUND`, msg, 404);
  }
}
