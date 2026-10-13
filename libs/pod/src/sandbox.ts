import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  PodRejected,
  type PodEvent,
  type PodOrderInput,
  type PodProvider,
  type PodStatus,
} from './port.js';

/**
 * A printer that behaves like one, for local runs and tests. Stateless on
 * purpose: the worker submits orders and the API receives webhooks — two
 * processes — so nothing can live in memory. The printer's order id is a pure
 * function of our reference, which is also what makes resubmission
 * idempotent. It refuses variants it does not stock, as a real catalogue would.
 */
const Event = z.object({
  id: z.string(),
  order: z.string(),
  status: z.enum(['PRINTING', 'SHIPPED', 'DELIVERED', 'RTO']),
  tracking: z.string().nullable(),
});

export class SandboxPrinter implements PodProvider {
  readonly name = 'sandbox';

  constructor(
    private readonly secret: string,
    /** Variant ids this "printer" stocks. Anything else is refused. */
    private readonly catalogue: (podVariantId: string) => boolean = (id) =>
      id.startsWith('sbx_'),
  ) {}

  async createOrder(input: PodOrderInput): Promise<{ podOrderId: string }> {
    const bad = input.items.filter((i) => !this.catalogue(i.podVariantId));
    if (bad.length)
      throw new PodRejected(
        `unknown variants: ${bad.map((b) => b.sku).join(', ')}`,
      );
    return { podOrderId: `sbx_order_${input.reference}` };
  }

  /** The signed webhook the press would send when an order reaches `status`. */
  webhook(
    podOrderId: string,
    status: PodStatus,
  ): { body: string; signature: string } {
    const body = JSON.stringify({
      id: `sbx_evt_${podOrderId}_${status}`,
      order: podOrderId,
      status,
      tracking:
        status === 'SHIPPED'
          ? `https://track.example.test/${podOrderId}`
          : null,
    });
    return {
      body,
      signature: createHmac('sha256', this.secret).update(body).digest('hex'),
    };
  }

  verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): boolean {
    const h = headers['x-sandbox-signature'];
    const sig = Array.isArray(h) ? h[0] : h;
    if (!sig) return false;
    const want = Buffer.from(
      createHmac('sha256', this.secret).update(rawBody).digest('hex'),
    );
    const got = Buffer.from(sig);
    return want.length === got.length && timingSafeEqual(want, got);
  }

  parseWebhook(body: unknown): PodEvent {
    const e = Event.parse(body);
    return {
      eventId: e.id,
      podOrderId: e.order,
      status: e.status,
      trackingUrl: e.tracking,
    };
  }
}
