import { z } from 'zod';

/** Server-side only. The admin never talks to the API from the browser. */
export const env = z
  .object({ API_URL: z.url().default('http://localhost:4100') })
  .parse(process.env);
