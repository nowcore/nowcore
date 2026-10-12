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
const Env = z.object({
  /** Defaults to the Postgres infra/docker-compose.yml publishes. */
  DATABASE_URL: z
    .url({ protocol: /^postgres(ql)?$/ })
    .default('postgresql://nowcore:nowcore@localhost:5433/nowcore'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  /** Containers need every interface, not just loopback. */
  HOST: z.string().default('0.0.0.0'),
  /** Origins allowed to call the API with credentials: web and admin. */
  WEB_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001')
    .transform((s) => s.split(',').map((o) => o.trim())),
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
