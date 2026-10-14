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
});

export const env = Env.parse(process.env);
