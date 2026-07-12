import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Outcome of a send attempt — mirrored into NotificationLog. */
export interface MailResult {
  /** SENT (provider accepted), SIMULATED (no API key — logged only), FAILED. */
  status: 'SENT' | 'SIMULATED' | 'FAILED';
  /** Provider message id when SENT. */
  providerMessageId?: string;
  /** Error detail when FAILED. */
  error?: string;
}

export interface MailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * MailerService — transactional email via Resend (Fase MVP product delivery).
 *
 * Uses a plain `fetch` to the Resend REST API so no SDK dependency is added.
 *
 * Dev escape-hatch (mirrors the GCASH_WEBHOOK_SECRET pattern): when
 * `RESEND_API_KEY` is not configured, the email is NOT sent — it's logged and
 * reported as SIMULATED. This keeps local dev, CI, and testnet demos running
 * without an email account, and never throws into the settlement pipeline.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private static readonly ENDPOINT = 'https://api.resend.com/emails';

  constructor(private readonly config: ConfigService) {}

  async send(input: MailInput): Promise<MailResult> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('RESEND_FROM');

    if (!apiKey) {
      this.logger.warn(
        `RESEND_API_KEY not set — email NOT sent (SIMULATED). ` +
          `to=${input.to} subject="${input.subject}"`,
      );
      return { status: 'SIMULATED' };
    }

    try {
      const res = await fetch(MailerService.ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => `HTTP ${res.status}`);
        this.logger.error(`Resend rejected email to ${input.to}: ${detail}`);
        return { status: 'FAILED', error: `HTTP ${res.status}: ${detail}` };
      }

      const body = (await res.json().catch(() => ({}))) as { id?: string };
      this.logger.log(`Email sent to ${input.to} (id=${body.id ?? 'unknown'})`);
      return { status: 'SENT', providerMessageId: body.id };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`Email send failed to ${input.to}: ${error}`);
      return { status: 'FAILED', error };
    }
  }
}
