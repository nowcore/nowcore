import { z } from 'zod';
import { hmacHex, header, sameHex } from './hmac.js';
import type {
  PaymentProvider,
  ProviderOrder,
  WebhookEvent,
} from './payment-provider.js';

/**
 * Razorpay (docs/03: UPI is the conversion unlock in India). Built against the
 * documented Orders API and signature schemes:
 *
 *   create order    POST https://api.razorpay.com/v1/orders, basic auth key_id:key_secret
 *   checkout sig    hex HMAC-SHA256(order_id + "|" + payment_id, key_secret)
 *   webhook sig     hex HMAC-SHA256(raw body, webhook_secret) in X-Razorpay-Signature
 *   event id        X-Razorpay-Event-Id
 *
 * Not yet run against Razorpay itself: no test keys exist (docs/08). The
 * signature maths is unit-tested; the HTTP calls are the unverified part.
 */
const RazorpayOrder = z.object({ id: z.string(), status: z.string() });

const Webhook = z.object({
  event: z.string(),
  payload: z.object({
    payment: z
      .object({
        entity: z.object({
          id: z.string(),
          order_id: z.string().nullable().optional(),
          method: z.string().optional(),
        }),
      })
      .optional(),
    order: z.object({ entity: z.object({ id: z.string() }) }).optional(),
  }),
});

const METHOD: Record<string, WebhookEvent['method']> = {
  upi: 'UPI',
  card: 'CARD',
  netbanking: 'NETBANKING',
  wallet: 'WALLET',
};

export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay' as const;

  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
    private readonly webhookSecret: string,
    private readonly base = 'https://api.razorpay.com/v1',
  ) {}

  private auth(): string {
    return `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;
  }

  async createOrder({
    amountPaise,
    receipt,
  }: {
    amountPaise: number;
    receipt: string;
  }): Promise<ProviderOrder> {
    const res = await fetch(`${this.base}/orders`, {
      method: 'POST',
      headers: {
        authorization: this.auth(),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt }),
    });
    if (!res.ok)
      throw new Error(
        `razorpay create order: ${res.status} ${await res.text()}`,
      );
    const order = RazorpayOrder.parse(await res.json());
    return { providerOrderId: order.id, keyId: this.keyId };
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
      hmacHex(this.keySecret, `${providerOrderId}|${paymentId}`),
      signature,
    );
  }

  verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): boolean {
    const sig = header(headers, 'x-razorpay-signature');
    return !!sig && sameHex(hmacHex(this.webhookSecret, rawBody), sig);
  }

  parseWebhook(
    body: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): WebhookEvent {
    const w = Webhook.parse(body);
    const payment = w.payload.payment?.entity;
    const providerOrderId =
      w.payload.order?.entity.id ?? payment?.order_id ?? null;
    const kind =
      w.event === 'order.paid' || w.event === 'payment.captured'
        ? 'paid'
        : w.event === 'payment.failed'
          ? 'failed'
          : 'other';
    return {
      // Razorpay sends a unique id per event; fall back to event+payment so
      // a missing header can never make two different events collide.
      eventId:
        header(headers, 'x-razorpay-event-id') ??
        `${w.event}:${payment?.id ?? providerOrderId}`,
      kind,
      providerOrderId,
      paymentId: payment?.id ?? null,
      method: payment?.method ? (METHOD[payment.method] ?? null) : null,
    };
  }

  async status(
    providerOrderId: string,
  ): Promise<'paid' | 'pending' | 'failed'> {
    const res = await fetch(
      `${this.base}/orders/${encodeURIComponent(providerOrderId)}`,
      {
        headers: { authorization: this.auth() },
      },
    );
    if (!res.ok) throw new Error(`razorpay fetch order: ${res.status}`);
    const order = RazorpayOrder.parse(await res.json());
    return order.status === 'paid' ? 'paid' : 'pending';
  }
}
