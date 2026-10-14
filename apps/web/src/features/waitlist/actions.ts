'use server';
import { redirect } from 'next/navigation';
import { env } from '../../env';

export type JoinResult = { ok: boolean; message: string } | null;

/** The film's "Never miss a drop" form (FR-8, T-083). Answers the same whether or not the email was already on the list. */
export async function joinWaitlist(
  _prev: JoinResult,
  form: FormData,
): Promise<JoinResult> {
  const email = String(form.get('email') ?? '').trim();
  const res = await fetch(`${env.API_URL}/waitlist`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
    cache: 'no-store',
  });
  if (res.status === 400)
    return { ok: false, message: 'That does not look like an email address.' };
  if (!res.ok)
    return {
      ok: false,
      message: 'Could not sign you up just now. Try again in a minute.',
    };
  return {
    ok: true,
    message: 'You are on the list. One message when the next drop opens.',
  };
}

export async function unsubscribe(
  email: string,
  token: string,
): Promise<boolean> {
  const res = await fetch(`${env.API_URL}/waitlist/unsubscribe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, token }),
    cache: 'no-store',
  });
  return res.ok;
}

/** The unsubscribe page's button. A POST, so a mail scanner opening the link changes nothing. */
export async function leaveList(form: FormData): Promise<never> {
  const ok = await unsubscribe(
    String(form.get('e') ?? ''),
    String(form.get('t') ?? ''),
  );
  redirect(`/unsubscribe?${ok ? 'done' : 'failed'}=1`);
}
