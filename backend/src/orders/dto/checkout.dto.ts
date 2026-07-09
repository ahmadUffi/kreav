import { IsEmail, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Body for POST /checkout. Source: Kreav Backend PRD v3 — §9 + BE-005.
 *
 * `buyerEmail` is where the product download link is delivered after the
 * settlement succeeds (product-delivery listener).
 */
export class CheckoutDto {
  @ApiProperty({
    description: 'Product ID (UUID) being purchased',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  productId!: string;

  @ApiProperty({
    description: "Buyer's email — the product download link is sent here after payment.",
    example: 'buyer@example.com',
  })
  @IsEmail({}, { message: 'buyerEmail must be a valid email address' })
  buyerEmail!: string;
}
