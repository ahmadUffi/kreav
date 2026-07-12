import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

/**
 * Thrown when an Order transition violates the v3.1 §20 state machine.
 * Maps to HTTP 400 with a machine-readable code so the frontend can react.
 */
export class InvalidStateTransitionException extends BadRequestException {
  constructor(from: OrderStatus, to: OrderStatus) {
    super({
      code: 'INVALID_STATE_TRANSITION',
      message: `Order cannot transition from ${from} to ${to}`,
      from,
      to,
    });
  }
}
