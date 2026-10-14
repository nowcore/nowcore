'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { post } from '../../../../lib/api';

/** One action per form; the API decides whether it is allowed. */
export async function act(form: FormData): Promise<void> {
  const reference = String(form.get('reference') ?? '');
  const action = String(form.get('action') ?? '');
  if (
    !/^[A-Z0-9-]+$/.test(reference) ||
    !['retry', 'cancel', 'refund'].includes(action)
  )
    return;
  const r = await post(
    `/admin/orders/${reference}/${action}`,
    action === 'refund' ? { note: String(form.get('note') ?? '') } : undefined,
  );
  revalidatePath(`/orders/${reference}`);
  redirect(
    `/orders/${reference}${r.ok ? '' : `?error=${encodeURIComponent(r.message)}`}`,
  );
}
