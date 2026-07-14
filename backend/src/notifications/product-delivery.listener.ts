import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExplorerService } from '../stellar/explorer.service';
import { AppEvents } from '../events/event-names';
import type { SettlementCompletedPayload } from '../events/event-payloads';
import { MailerService } from './mailer.service';

/**
 * ProductDeliveryListener — MVP product delivery.
 *
 * When a settlement completes (money is in the creator's wallet), email the
 * buyer their product download link and record the attempt in NotificationLog.
 *
 * Trigger is `settlement.completed` (NOT `payment.received`) so the product is
 * only delivered after the on-chain split actually succeeded — a failed
 * settlement never ships the goods.
 *
 * The handler never throws: a delivery failure is logged + recorded, but must
 * not break the settlement pipeline.
 */
@Injectable()
export class ProductDeliveryListener {
  private readonly logger = new Logger(ProductDeliveryListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly explorer: ExplorerService,
  ) {}

  @OnEvent(AppEvents.SettlementCompleted)
  async handleSettlementCompleted(payload: SettlementCompletedPayload): Promise<void> {
    const { orderId, txHash } = payload;
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          buyerEmail: true,
          product: { select: { title: true, fileUrl: true } },
        },
      });

      if (!order?.product) {
        this.logger.error(`Cannot deliver product for order ${orderId} — order/product not found`);
        return;
      }

      const { buyerEmail, product } = order;
      if (!product.fileUrl) {
        this.logger.error(`Order ${orderId} product has no fileUrl — nothing to deliver`);
        return;
      }
      const explorerUrl = this.explorer.txUrl(txHash);
      const html = this.buildEmail(product.title, product.fileUrl, explorerUrl);

      const result = await this.mailer.send({
        to: buyerEmail,
        subject: `Your Kreav purchase is ready — ${product.title}`,
        html,
      });

      await this.prisma.notificationLog.create({
        data: {
          recipient: buyerEmail,
          channel: NotificationChannel.EMAIL,
          event: AppEvents.SettlementCompleted,
          status: result.status === 'FAILED' ? NotificationStatus.FAILED : NotificationStatus.SENT,
          attempts: 1,
          providerMessageId: result.status === 'SIMULATED' ? 'SIMULATED' : result.providerMessageId,
          lastError: result.error,
        },
      });

      this.logger.log(`Product delivery for order ${orderId} → ${buyerEmail}: ${result.status}`);
    } catch (err) {
      // Never let a delivery failure escape into the event pipeline.
      this.logger.error(
        `Product delivery failed for order ${orderId}: ` +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  /** Minimal, inline-styled delivery email (no external assets). */
  private buildEmail(title: string, fileUrl: string, explorerUrl: string): string {
    return [
      `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">`,
      `<h2 style="margin:0 0 12px">Your purchase is ready 🎉</h2>`,
      `<p style="margin:0 0 16px;color:#444">Thanks for buying <strong>${escapeHtml(title)}</strong> on Kreav. Your download link:</p>`,
      `<p style="margin:0 0 20px"><a href="${escapeHtml(fileUrl)}" style="background:#FFE600;color:#0A0A0A;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Download your product</a></p>`,
      `<p style="margin:0 0 8px;color:#666;font-size:13px">Or paste this link: ${escapeHtml(fileUrl)}</p>`,
      `<p style="margin:16px 0 0;color:#888;font-size:12px">Settled on Stellar — <a href="${escapeHtml(explorerUrl)}" style="color:#888">view the transaction</a>.</p>`,
      `</div>`,
    ].join('');
  }
}

/** Escape user/product-controlled strings before interpolating into HTML. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
