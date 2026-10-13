import { z } from 'zod';

/**
 * The worker's environment, parsed once at boot. Source credentials (Reddit,
 * YouTube, Printrove, Resend) join with the jobs that use them.
 */
const Env = z.object({
  /** Defaults to the Redis infra/docker-compose.yml publishes. */
  REDIS_URL: z.url({ protocol: /^rediss?$/ }).default('redis://127.0.0.1:6381'),
  /** Where rendered frames are written until Supabase Storage (T-035). */
  FRAMES_DIR: z
    .string()
    .default(new URL('../../web/public/frames', import.meta.url).pathname),
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
