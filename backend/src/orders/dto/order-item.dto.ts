import { ApiProperty } from '@nestjs/swagger';

/**
 * Single order item returned in list and detail responses.
 *
 * Includes the product title and price for display. Monetary values are
 * strings (DecimalToStringInterceptor convention).
 *
 * Source: BE-018 — Orders Read API.
 */
export class OrderItemDto {
  @ApiProperty({
    description: 'Order ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Product title',
    example: 'Lightroom Sunset Presets',
  })
  productTitle!: string;

  @ApiProperty({
    description: 'Product price (USD)',
    example: '18.00',
  })
  productPrice!: string;

  @ApiProperty({
    description: 'Buyer email address',
    example: 'buyer+1234567890@kreav.test',
  })
  buyerEmail!: string;

  @ApiProperty({
    description: 'Order amount (USD)',
    example: '18.00',
  })
  amountUsd!: string;

  @ApiProperty({
    description: 'Order status',
    example: 'PAYMENT_RECEIVED',
  })
  status!: string;

  @ApiProperty({
    description: 'Payment reference ID (GCash transaction)',
    required: false,
    example: 'gcash-txn-abc123',
  })
  paymentRef?: string;

  @ApiProperty({
    description: 'Stellar settlement transaction hash',
    required: false,
    example: 'a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f8090',
  })
  txHash?: string;

  @ApiProperty({
    description: 'ISO-8601 timestamp of when the order was created',
    example: '2026-06-30T12:00:00.000Z',
  })
  createdAt!: string;
}

/**
 * Paginated response for GET /orders.
 *
 * Source: BE-018 — Orders Read API.
 */
export class OrdersListResponseDto {
  @ApiProperty({
    description: 'Array of order items',
    type: [OrderItemDto],
  })
  data!: OrderItemDto[];

  @ApiProperty({ description: 'Current page (1-indexed)', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Total matching records', example: 42 })
  total!: number;
}
