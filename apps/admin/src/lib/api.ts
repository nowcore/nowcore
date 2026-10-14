import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { z } from 'zod';
import { env } from '../env';

/**
 * Every admin read and write goes through here, server-side, with the
 * operator's session token from an httpOnly cookie. The browser never holds
 * the token in JavaScript and never calls the API directly. A 401 anywhere —
 * expired, signed out elsewhere — sends the operator back to sign in.
 */
export const SESSION_COOKIE = 'nc_admin';

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect('/login');
  const res = await fetch(`${env.API_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      ...init.headers,
      authorization: `Bearer ${token}`,
      // Only with a body: Fastify refuses an empty body declared as JSON, which
      // made every body-less action (retry, cancel) fail from the admin while
      // passing in the API's own tests, which sent no content type at all.
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
  });
  if (res.status === 401) redirect('/login?expired=1');
  return res;
}

export async function get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const res = await call(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return schema.parse(await res.json());
}

/** A write. Returns the API's message on refusal, for the page to show. */
export async function post(
  path: string,
  body?: object,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await call(path, {
    method: 'POST',
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.ok) return { ok: true };
  const json = (await res.json().catch(() => ({}))) as { message?: string };
  return { ok: false, message: json.message ?? `Refused (${res.status}).` };
}
