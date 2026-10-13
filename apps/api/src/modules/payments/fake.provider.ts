import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { hmacHex, header, sameHex } from './hmac.js';
import type {
  PaymentProvider,
  ProviderOrder,
  WebhookEvent,
} from './payment-provider.js';

/**
 * A stand-in provider so checkout runs end to end before Razorpay test keys
 * exist. It signs exactly as Razorpay does, so the order code it exercises is
 * the real order code. It can never run in production: env.ts refuses
 * PAYMENTS=fake when NODE_ENV=production.
 */
const FakeWebhook = z.object({
  event: z.enum(['paid', 'failed']),
  providerOrderId: z.string(),
  paymentId: z.string(),
});

export class FakeProvider implements PaymentProvider {
  readonly name = 'fake' as const;
  private readonly paid = new Set<string>();

  constructor(private readonly secret: string) {}

  async createOrder(): Promise<ProviderOrder> {
    return { providerOrderId: `fake_order_${randomUUID()}`, keyId: null };
  }

  /** What the browser's "pay" would return. Used by the dev-only pay route. */
  pay(providerOrderId: string): { paymentId: string; signature: string } {
    const paymentId = `fake_pay_${randomUUID()}`;
    this.paid.add(providerOrderId);
    return {
      paymentId,
      signature: hmacHex(this.secret, `${providerOrderId}|${paymentId}`),
    };
  }

  /** A signed webhook body, for tests and the dev pay route. */
  webhook(
    event: 'paid' | 'failed',
    providerOrderId: string,
    paymentId: string,
  ): { body: string; signature: string } {
    const body = JSON.stringify({ event, providerOrderId, paymentId });
    return { body, signature: hmacHex(this.secret, body) };
  }

  verifyCheckout({
    providerOrderId,
    paymentId,
    signature,
  }: {
    providerOrderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    return sameHex(
      hmacHex(this.secret, `${providerOrderId}|${paymentId}`),
      signature,
    );
  }

  verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): boolean {
    const sig = header(headers, 'x-fake-signature');
    return !!sig && sameHex(hmacHex(this.secret, rawBody), sig);
  }

  parseWebhook(body: unknown): WebhookEvent {
    const w = FakeWebhook.parse(body);
    return {
      eventId: `${w.event}:${w.paymentId}`,
      kind: w.event,
      providerOrderId: w.providerOrderId,
      paymentId: w.paymentId,
      method: 'UPI',
    };
  }

  async status(
    providerOrderId: string,
  ): Promise<'paid' | 'pending' | 'failed'> {
    return this.paid.has(providerOrderId) ? 'paid' : 'pending';
  }
}
