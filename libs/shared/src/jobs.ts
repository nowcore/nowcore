import { z } from 'zod';

/**
 * Queue payloads, shared by the API (producer) and the worker (consumer).
 * Zod at every boundary includes this one: a job written by an older API and
 * read by a newer worker fails loudly instead of acting on a missing field.
 */
export const QUEUE = { pod: 'pod', notify: 'notify' } as const;

export const PodSubmitJob = z.object({ orderId: z.uuid() });
export type PodSubmitJob = z.infer<typeof PodSubmitJob>;

export const NotifyJob = z.object({
  orderId: z.uuid(),
  kind: z.enum(['confirmed', 'shipped']),
});
export type NotifyJob = z.infer<typeof NotifyJob>;
