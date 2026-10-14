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

export type WriteResult =
  | { ok: true; data?: unknown }
  | {
      ok: false;
      message: string;
      problems?: string[];
      fields?: Record<string, string>;
    };

/** A write. Returns the API's message — and its problem list, if any — on refusal, for the page to show. */
export async function send(
  method: 'POST' | 'PATCH' | 'PUT',
  path: string,
  body?: unknown,
): Promise<WriteResult> {
  const res = await call(path, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (res.ok)
    return res.status === 204
      ? { ok: true }
      : { ok: true, data: await res.json().catch(() => undefined) };
  const json = (await res.json().catch(() => ({}))) as {
    message?: string;
    problems?: string[];
    fields?: Record<string, string>;
  };
  return {
    ok: false,
    message: json.message ?? `Refused (${res.status}).`,
    ...(json.problems ? { problems: json.problems } : {}),
    ...(json.fields ? { fields: json.fields } : {}),
  };
}

export const post = (path: string, body?: object) => send('POST', path, body);
