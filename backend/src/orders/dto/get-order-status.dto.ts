import { IsEmail, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Body for POST /orders/status — public buyer-facing order polling.
 *
 * Separated from `GET /orders/:id` (owner-scoped, JWT-guarded). This endpoint
 * validates the buyer via `orderId + buyerEmail` (both already known to the
 * buyer from the checkout response) so no auth token is required.
 */
export class GetOrderStatusDto {
  @ApiProperty({
    description: 'Order ID (UUID) returned by POST /checkout',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  orderId!: string;

  @ApiProperty({
    description: 'Buyer email — must match the email used at checkout.',
    example: 'buyer@example.com',
  })
  @IsEmail({}, { message: 'buyerEmail must be a valid email address' })
  buyerEmail!: string;
}
