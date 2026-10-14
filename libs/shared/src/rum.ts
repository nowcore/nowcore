import { z } from 'zod';

/**
 * Field performance (T-094): what a real visit measured, sent once per page
 * view. Anonymous by construction — coarse device hints only, no identifier,
 * no user agent, no IP stored — because the question is "is the film fast on
 * the phones people have", not who has them.
 */
export const RumMetric = z.enum([
  'LCP',
  'INP',
  'CLS',
  'FCP',
  'TTFB',
  'SCROLL_FT95',
]);
export type RumMetric = z.infer<typeof RumMetric>;

export const RumBeacon = z.object({
  /** The route pattern, not the URL: "/product/[slug]", never a query string. */
  route: z
    .string()
    .regex(/^\/[\w\-/[\]]*$/)
    .max(100),
  tier: z.enum(['full', 'reduced', 'static']),
  cores: z.number().int().min(1).max(256).optional(),
  /** navigator.deviceMemory, in GB (Chrome rounds it: 0.25–8). */
  memory: z.number().min(0).max(64).optional(),
  net: z.enum(['slow-2g', '2g', '3g', '4g']).optional(),
  mobile: z.boolean(),
  metrics: z
    .array(
      z.object({
        name: RumMetric,
        // ms for timings, unitless for CLS; generous ceilings, junk is refused.
        value: z.number().min(0).max(120_000),
      }),
    )
    .min(1)
    .max(8),
});
export type RumBeacon = z.infer<typeof RumBeacon>;

export const RumCell = z.object({
  samples: z.number().int(),
  /** p75 for vitals (the CrUX convention); scroll is reported as fps at the 95th-percentile frame time. */
  value: z.number().nullable(),
});

export const AdminRum = z.object({
  days: z.number().int(),
  pageViews: z.number().int(),
  /** metric → segment ("all", "low-end", "full", "reduced", "static") → cell */
  table: z.partialRecord(RumMetric, z.record(z.string(), RumCell)),
});
export type AdminRum = z.infer<typeof AdminRum>;
