import { z } from 'zod';

/**
 * Server-side environment for the web app. Nothing here is NEXT_PUBLIC: the
 * API's address is only used by server components and server actions, and a
 * provider secret must never be readable here at all (docs/07 §4).
 */
const Env = z.object({
  API_URL: z.url().default('http://localhost:4100'),
  /** Shared with the API, which calls /api/revalidate when the catalogue changes. */
  REVALIDATE_SECRET: z.string().min(16).default('local-dev-revalidate-secret'),
  /** Signs the buyer IP forwarded to the API's rate limits (lib/forwarded.ts). Shared with the API. */
  BFF_SECRET: z.string().min(16).default('local-dev-bff-secret-0000'),
});

export const env = Env.parse(process.env);
