import { z } from 'zod';

/**
 * The worker's environment, parsed once at boot. Source credentials (Reddit,
 * YouTube, Printrove, Resend) join with the jobs that use them.
 */
const Env = z.object({
  DATABASE_URL: z
    .url({ protocol: /^postgres(ql)?$/ })
    .default('postgresql://nowcore:nowcore@localhost:5433/nowcore'),
  /** Must match the API's: printer webhooks are verified there. */
  POD: z.enum(['sandbox']).default('sandbox'),
  POD_SANDBOX_SECRET: z
    .string()
    .default('pod-sandbox-secret-for-local-dev-only'),
  /** `console` prints emails locally; `resend` sends them. */
  MAILER: z.enum(['console', 'resend']).default('console'),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default('NOWCORE <orders@nowcore.example>'),
  /** Where order links in emails point; the token must match the API's secret. */
  WEB_URL: z.url().default('http://localhost:3000'),
  ORDER_TOKEN_SECRET: z
    .string()
    .min(32)
    .default('local-dev-order-token-secret-change-me-0000'),
  /** Defaults to the Redis infra/docker-compose.yml publishes. */
  REDIS_URL: z.url({ protocol: /^rediss?$/ }).default('redis://127.0.0.1:6381'),
  /**
   * BullMQ key prefix. Every real process uses the default; each test run
   * gets its own, so test jobs can never be taken by another suite's worker
   * or by a developer's running one (found 14 Oct 2026: two worker suites
   * consumed each other's jobs).
   */
  QUEUE_PREFIX: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .default('nowcore'),
  /** Uploaded artwork, shared with the API; local stand-in for Supabase Storage (T-035). */
  STORAGE_DIR: z
    .string()
    .default(new URL('../../../.storage', import.meta.url).pathname),
  /** Where rendered frames are written until Supabase Storage (T-035). */
  FRAMES_DIR: z
    .string()
    .default(new URL('../../../.storage/frames', import.meta.url).pathname),
});
export type Env = z.infer<typeof Env>;

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = Env.safeParse(source);
  if (parsed.success) return parsed.data;
  const problems = parsed.error.issues
    .map((i) => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`the worker's environment is not usable:\n${problems}`);
}

/** BullMQ wants host/port, not a URL. */
export function redisConnection(url: string): {
  host: string;
  port: number;
  password?: string;
} {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
  };
}
