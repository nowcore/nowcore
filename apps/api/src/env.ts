import { z } from 'zod';

/**
 * Everything the API reads from its environment, parsed once at boot.
 * A missing or malformed value stops the process before it takes a request,
 * not on whichever request first needed it.
 *
 * Provider credentials (Razorpay, Printrove, Supabase) join this schema with
 * the tasks that use them — T-052, T-059, T-063 — so nothing here is a
 * variable that nothing reads.
 */
const Env = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    /** Defaults to the Postgres infra/docker-compose.yml publishes. */
    DATABASE_URL: z
      .url({ protocol: /^postgres(ql)?$/ })
      .default('postgresql://nowcore:nowcore@localhost:5433/nowcore'),
    // 4100, not 4000: country_dairy's API holds 4000 on the reference machine.
    PORT: z.coerce.number().int().min(1).max(65535).default(4100),
    /** Containers need every interface, not just loopback. */
    HOST: z.string().default('0.0.0.0'),
    /** Origins allowed to call the API with credentials: web and admin. */
    WEB_ORIGINS: z
      .string()
      .default('http://localhost:3000,http://localhost:3001')
      .transform((s) => s.split(',').map((o) => o.trim())),

    /**
     * Which payment provider takes money. `fake` exists so the whole checkout
     * can be run locally before Razorpay test keys exist; it is refused in
     * production below, so it can never take a real order.
     */
    PAYMENTS: z.enum(['razorpay', 'fake']).default('fake'),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
    /** Secret for the fake provider's signatures. Development only. */
    FAKE_PAYMENTS_SECRET: z
      .string()
      .default('fake-payments-secret-for-local-dev-only'),

    /**
     * Signs order-view tokens (docs/05 §6). A default exists for local work
     * only; production must set its own, and is refused without one.
     */
    ORDER_TOKEN_SECRET: z
      .string()
      .min(32)
      .default('local-dev-order-token-secret-change-me-0000'),

    /** The fulfilment queue lives here; the worker consumes it. */
    REDIS_URL: z
      .url({ protocol: /^rediss?$/ })
      .default('redis://127.0.0.1:6381'),
    /**
     * Rendered turntables, served by this API at /frames until Supabase
     * Storage (T-035). Never inside the web app's public/: Next serves only
     * what existed at build time, so a drop rendered after a deploy 404'd.
     */
    FRAMES_DIR: z
      .string()
      .default(new URL('../../../.storage/frames', import.meta.url).pathname),
    /** The storefront's cache-busting webhook; called when a drop opens, closes or changes. */
    WEB_REVALIDATE_URL: z.url().default('http://localhost:3000/api/revalidate'),
    REVALIDATE_SECRET: z
      .string()
      .min(16)
      .default('local-dev-revalidate-secret'),
    /** Where frame URLs point. This API locally; the storage CDN in production. */
    ASSET_BASE_URL: z.url().default('http://localhost:4100'),
    /** Uploaded artwork, shared with the worker; local stand-in for Supabase Storage (T-035). */
    STORAGE_DIR: z
      .string()
      .default(new URL('../../../.storage', import.meta.url).pathname),
    /** BullMQ key prefix — must match the worker's. Tests use their own (see the worker's env). */
    QUEUE_PREFIX: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .default('nowcore'),

    /**
     * Which printer fulfils orders. Only `sandbox` exists until the Printrove
     * adapter is written against their docs; it is refused in production.
     */
    POD: z.enum(['sandbox']).default('sandbox'),
    POD_SANDBOX_SECRET: z
      .string()
      .default('pod-sandbox-secret-for-local-dev-only'),

    /** Poll the provider for orders a webhook never confirmed (T-057). Off in tests. */
    RECONCILE: z.enum(['on', 'off']).default('on'),
  })
  .superRefine((env, ctx) => {
    if (env.PAYMENTS === 'razorpay') {
      for (const key of [
        'RAZORPAY_KEY_ID',
        'RAZORPAY_KEY_SECRET',
        'RAZORPAY_WEBHOOK_SECRET',
      ] as const) {
        if (!env[key])
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'required when PAYMENTS=razorpay',
          });
      }
    }
    if (env.NODE_ENV === 'production') {
      if (env.PAYMENTS === 'fake') {
        ctx.addIssue({
          code: 'custom',
          path: ['PAYMENTS'],
          message: 'the fake provider can never run in production',
        });
      }
      if (env.POD === 'sandbox') {
        ctx.addIssue({
          code: 'custom',
          path: ['POD'],
          message: 'the sandbox printer can never fulfil real orders',
        });
      }
      if (env.ORDER_TOKEN_SECRET.startsWith('local-dev-')) {
        ctx.addIssue({
          code: 'custom',
          path: ['ORDER_TOKEN_SECRET'],
          message: 'set a real secret in production',
        });
      }
    }
  });

export type Env = z.infer<typeof Env>;

/** The DI token, so a test can hand the app an environment of its own. */
export const ENV = Symbol('ENV');

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = Env.safeParse(source);
  if (parsed.success) return parsed.data;
  const problems = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`the API's environment is not usable:\n${problems}`);
}
