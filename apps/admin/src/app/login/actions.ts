'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Session } from '@nowcore/shared';
import { env } from '../../env';
import { SESSION_COOKIE } from '../../lib/api';

export async function signIn(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const res = await fetch(`${env.API_URL}/admin/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    return json.message ?? 'Could not sign in.';
  }
  const s = Session.parse(await res.json());
  (await cookies()).set(SESSION_COOKIE, s.token, {
    httpOnly: true,
    // Strict: the admin is never entered from another site's link.
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(s.expiresAt),
  });
  redirect('/');
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await fetch(`${env.API_URL}/admin/session`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
  jar.delete(SESSION_COOKIE);
  redirect('/login');
}
