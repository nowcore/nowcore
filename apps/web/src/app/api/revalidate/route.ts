import { revalidateTag } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../../../env';

/**
 * The catalogue changed — a drop opened, closed or was edited. The API calls
 * this so the storefront shows it at once instead of after its 30 s cache
 * (found 14 Oct 2026: a newly opened drop showed the previous one until the
 * stale-while-revalidate cycle turned over). A webhook, so it lives in
 * app/api — BFF only, no domain logic (CLAUDE.md).
 */
export async function POST(req: Request): Promise<Response> {
  const sent = Buffer.from(req.headers.get('x-revalidate-secret') ?? '');
  const want = Buffer.from(env.REVALIDATE_SECRET);
  if (sent.length !== want.length || !timingSafeEqual(sent, want))
    return new Response(null, { status: 401 });
  revalidateTag('catalogue', 'max');
  return Response.json({ revalidated: true });
}
