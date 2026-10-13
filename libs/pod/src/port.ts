import { z } from 'zod';

/**
 * The fulfilment port (ADR-001). The order domain talks to this; only an
 * adapter knows a printer. Printrove is the first real adapter (pending its
 * API docs and credentials); `SandboxPrinter` stands in until then and is what
 * every test and local run uses.
 */
export const PodItem = z.object({
  /** The printer's id for this exact garment (variants.pod_variant_id). */
  podVariantId: z.string().min(1),
  sku: z.string(),
  quantity: z.number().int().positive(),
});

export const PodOrderInput = z.object({
  /** Our order reference — also the idempotency key the printer must honour. */
  reference: z.string(),
  cod: z.boolean(),
  /** Paise; the printer collects it on delivery when cod is true. */
  collectPaise: z.number().int().nonnegative(),
  ship: z.object({
    name: z.string(),
    phone: z.string(),
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    pincode: z.string(),
  }),
  items: z.array(PodItem).min(1),
});
export type PodOrderInput = z.infer<typeof PodOrderInput>;

/** What a printer can tell us about an order, mapped to our state machine. */
export type PodStatus = 'PRINTING' | 'SHIPPED' | 'DELIVERED' | 'RTO';

export interface PodEvent {
  /** The printer's id for this delivery — the webhook idempotency key. */
  eventId: string;
  podOrderId: string;
  status: PodStatus;
  trackingUrl: string | null;
}

export interface PodProvider {
  readonly name: string;
  /**
   * Submit an order. Must be idempotent on `reference`: a worker can crash
   * after the printer accepted but before we saved its id, and the retry must
   * get the same order back, not print the garment twice.
   */
  createOrder(input: PodOrderInput): Promise<{ podOrderId: string }>;
  verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): boolean;
  parseWebhook(body: unknown): PodEvent;
}

/** Thrown for failures a retry cannot fix — a bad variant, a refused address. */
export class PodRejected extends Error {}

/** SKUs whose variants have no printer mapping. Empty means the order can be printed. */
export function unmapped(
  items: { sku: string; podVariantId: string | null }[],
): string[] {
  return items.filter((i) => !i.podVariantId).map((i) => i.sku);
}
