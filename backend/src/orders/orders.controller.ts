import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiCreatedResponse,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { OrdersService } from './orders.service';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CheckoutDto } from './dto/checkout.dto';
import { GcashWebhookDto } from './dto/gcash-webhook.dto';
import { OrdersListQueryDto } from './dto/orders-list-query.dto';
import { OrdersListResponseDto } from './dto/order-item.dto';
import { WebhookSignature } from './webhook-signature';

/**
 * OrdersController — BE-005 + BE-018.
 *
 * Write endpoints:
 *   POST /checkout           — create an order (buyer side)
 *   POST /webhooks/gcash     — mock GCash payment confirmation (provider side)
 *
 * Read endpoints (BE-018):
 *   GET  /orders             — paginated order list (optional ?creatorId=)
 *   GET  /orders/:id         — single order with settlement details
 *
 * Audit #7 — rate limiting: checkout is throttled tighter than the global
 * default (buyers shouldn't spam orders), and the webhook gets an even tighter
 * ceiling since a payment provider only confirms once per order.
 *
 * Audit #11 — the webhook verifies an HMAC signature over the raw body before
 * trusting it; the body is parsed into the DTO only AFTER verification.
 */
@ApiTags('Orders')
@Controller()
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
  ) {}

  /**
   * POST /checkout — create an order for a product.
   */
  @Post('checkout')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create an order (checkout)',
    description: 'Creates a new order for a product. The order starts in PAYMENT_PENDING status.',
  })
  @ApiBody({
    type: CheckoutDto,
    description: 'Checkout payload — just the product ID',
    examples: {
      sunset: {
        summary: '🌅 Lightroom Sunset Presets',
        value: { productId: '550e8400-e29b-41d4-a716-446655440000' },
      },
      notion: {
        summary: '🗂️ Notion Creator OS',
        value: { productId: '550e8400-e29b-41d4-a716-446655440001' },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Order created successfully',
    schema: { example: { orderId: '660e8400-e29b-41d4-a716-446655440000' } },
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  checkout(@Body() dto: CheckoutDto) {
    return this.orders.checkout(dto.productId);
  }

  /**
   * POST /webhooks/gcash — confirm a GCash payment.
   *
   * The signature is verified against the RAW body (before JSON parsing), so we
   * read `req.rawBody` (NestJS exposes it when `rawBody: true` is set in
   * bootstrap). Only then is the body trusted and validated into the DTO.
   */
  @Post('webhooks/gcash')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Receive GCash payment webhook',
    description:
      'Mock GCash webhook to confirm a payment. Verifies HMAC signature over the raw body. ' +
      'Idempotent on paymentRef — duplicate webhooks are silently acknowledged.',
  })
  @ApiBody({
    type: GcashWebhookDto,
    description: 'GCash webhook payload',
    examples: {
      success: {
        summary: '✅ Payment confirmed',
        value: { orderId: '660e8400-e29b-41d4-a716-446655440000', paymentRef: 'gcash-txn-abc123' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Payment confirmed' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
  async handleGcashWebhook(
    @Req() req: Request,
    @Headers('x-gcash-signature') signature: string | undefined,
    @Body() dto: GcashWebhookDto,
  ) {
    const secret = this.config.get<string>('GCASH_WEBHOOK_SECRET');

    // req.rawBody is populated by NestJS when rawBody: true is configured.
    const rawBody: Buffer | undefined = (req as { rawBody?: Buffer }).rawBody;
    if (!WebhookSignature.verify(rawBody ?? Buffer.alloc(0), signature, secret)) {
      this.logger.warn(`webhook/gcash rejected: invalid signature (order=${dto.orderId})`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    if (!secret) {
      // Escape hatch active — make the demo security posture visible in logs.
      this.logger.warn(
        'GCASH_WEBHOOK_SECRET not set — webhook signature NOT enforced. Set it before on-stage demo.',
      );
    }

    return this.orders.handleGcashPayment(dto.orderId, dto.paymentRef);
  }

  // ── BE-018: Read endpoints ───────────────────────────────────────────────

  /**
   * GET /orders — paginated order list for the authenticated creator.
   *
   * Fase 1: the creator scope comes from the session JWT — the old
   * `?creatorId=` query param is gone (identity is never a query param).
   */
  @Get('orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List orders (authenticated creator)',
    description:
      'Returns a paginated list of orders for products owned by the ' +
      'authenticated creator. Ordered newest-first. ' +
      'Each order includes the product title and price.',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number (1-indexed)',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Items per page',
    required: false,
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of orders',
    type: OrdersListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid bearer token' })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: OrdersListQueryDto,
  ): Promise<{
    data: Array<Record<string, unknown>>;
    page: number;
    limit: number;
    total: number;
  }> {
    this.logger.log(`GET /orders user=${user.userId} page=${query.page} limit=${query.limit}`);
    return this.orders.findAll({ ...query, creatorId: user.userId });
  }

  /**
   * GET /orders/:id — single order with settlement details.
   */
  @Get('orders/:id')
  @ApiOperation({
    summary: 'Get order by ID',
    description:
      'Returns a single order with product and settlement details. ' +
      'Throws 404 if the order is not found.',
  })
  @ApiParam({
    name: 'id',
    description: 'Order ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: 200, description: 'Order found' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findOne(@Param('id') id: string): Promise<Record<string, unknown>> {
    this.logger.log(`GET /orders/${id}`);
    return this.orders.findOne(id);
  }
}
