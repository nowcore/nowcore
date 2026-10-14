import { z } from 'zod';

/**
 * Queue payloads, shared by the API (producer) and the worker (consumer).
 * Zod at every boundary includes this one: a job written by an older API and
 * read by a newer worker fails loudly instead of acting on a missing field.
 */
export const QUEUE = {
  pod: 'pod',
  notify: 'notify',
  render: 'render',
} as const;

export const PodSubmitJob = z.object({ orderId: z.uuid() });
export type PodSubmitJob = z.infer<typeof PodSubmitJob>;

export const NotifyJob = z.object({
  orderId: z.uuid(),
  kind: z.enum(['confirmed', 'shipped']),
});
export type NotifyJob = z.infer<typeof NotifyJob>;

/**
 * Render one colourway's turntable from uploaded artwork (T-066). The artwork
 * travels as a storage key, not bytes: a print file is megabytes, and Redis
 * is not a file store.
 */
export const RenderJob = z.object({
  productId: z.uuid(),
  drop: z.string(),
  colourCode: z.string().regex(/^[a-z]{2,5}$/),
  colourName: z.string(),
  garmentHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  artworkKey: z.string().regex(/^[a-z0-9/_.-]+$/),
  /** A fresh revision per upload, so frame URLs change and no browser shows a cached old turn. */
  rev: z.string().regex(/^[a-z0-9]{4,16}$/),
});
export type RenderJob = z.infer<typeof RenderJob>;
