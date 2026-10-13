import 'server-only';
import { z } from 'zod';
import { DropSummary, DropView, ProductPage } from '@nowcore/shared';
import { env } from '../env';

/**
 * The catalogue, read from the API (T-045). Every response is parsed with the
 * shared contract, so a shape change fails here, loudly, instead of rendering
 * `undefined` on a product page. Cached for 30 s in Next's data cache — the
 * same window the API's own Cache-Control allows; stock is re-checked when an
 * order is placed, never trusted from here.
 */
export class NotFound extends Error {}

async function get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(`${env.API_URL}${path}`, {
    next: { revalidate: 30, tags: ['catalogue'] },
  });
  if (res.status === 404) throw new NotFound(path);
  if (!res.ok) throw new Error(`API ${path} answered ${res.status}`);
  return schema.parse(await res.json());
}

export const liveDrop = () => get('/drops/live', DropView);
export const archive = () => get('/drops/archive', z.array(DropSummary));
export const productPage = (slug: string) =>
  get(`/products/${encodeURIComponent(slug)}`, ProductPage);
