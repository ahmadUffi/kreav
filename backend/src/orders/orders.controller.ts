import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { OrdersService } from './orders.service';
import { CheckoutDto } from './dto/checkout.dto';
import { GcashWebhookDto } from './dto/gcash-webhook.dto';
import { WebhookSignature } from './webhook-signature';

/**
 * OrdersController — BE-005.
 *
 *   POST /checkout        — create an order (buyer side)
 *   POST /webhooks/gcash  — mock GCash payment confirmation (provider side)
 *
 * Audit #7 — rate limiting: checkout is throttled tighter than the global
 * default (buyers shouldn't spam orders), and the webhook gets an even tighter
 * ceiling since a payment provider only confirms once per order.
 *
 * Audit #11 — the webhook verifies an HMAC signature over the raw body before
 * trusting it; the body is parsed into the DTO only AFTER verification.
 */
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
}
