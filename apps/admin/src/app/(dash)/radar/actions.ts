'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { post } from '../../../lib/api';

const back = (error?: string) => {
  revalidatePath('/radar');
  redirect(error ? `/radar?error=${encodeURIComponent(error)}` : '/radar');
};

export async function decide(f: FormData): Promise<void> {
  const r = await post('/admin/trends/decide', {
    key: String(f.get('key')),
    action: String(f.get('action')),
  });
  back(r.ok ? undefined : r.message);
}

/** Promote, then straight into the new draft — the operator's next job is its artwork. */
export async function promote(f: FormData): Promise<void> {
  const r = await post('/admin/trends/promote', { key: String(f.get('key')) });
  if (!r.ok) return back(r.message);
  redirect(
    `/drops/${(r.data as { slug: string }).slug}?ok=${encodeURIComponent('Drafted from the radar. Its evidence is linked.')}`,
  );
}
