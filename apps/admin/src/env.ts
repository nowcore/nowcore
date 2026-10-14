import { z } from 'zod';

/** Server-side only. The admin never talks to the API from the browser. */
export const env = z
  .object({
    API_URL: z.url().default('http://localhost:4100'),
    /** Signs the buyer IP forwarded to the API's rate limits (lib/forwarded.ts). Shared with the API. */
    BFF_SECRET: z.string().min(16).default('local-dev-bff-secret-0000'),
  })
  .parse(process.env);
