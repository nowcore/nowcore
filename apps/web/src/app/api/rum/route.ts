import { env } from '../../../env';
import { forwarded } from '../../../lib/forwarded';

/**
 * Field-performance beacons (T-094), passed through to the API — the browser
 * never calls the API itself. No logic here: the API validates and stores.
 * Bodies over 4 KB are dropped before they leave this server.
 */
export async function POST(req: Request): Promise<Response> {
  const body = await req.text();
  if (body.length > 4096) return new Response(null, { status: 413 });
  const res = await fetch(`${env.API_URL}/rum`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await forwarded()) },
    body,
    cache: 'no-store',
  }).catch(() => null);
  return new Response(null, { status: res?.status ?? 502 });
}
