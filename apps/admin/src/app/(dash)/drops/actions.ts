'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { send, type WriteResult } from '../../../lib/api';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const back = (slug: string, r: WriteResult, ok = '') => {
  revalidatePath(`/drops/${slug}`);
  const q = r.ok
    ? ok
      ? `?ok=${encodeURIComponent(ok)}`
      : ''
    : `?error=${encodeURIComponent([r.message, ...(r.problems ?? [])].join('\n'))}`;
  redirect(`/drops/${slug}${q}`);
};

export type CreateResult = {
  message: string;
  fields: Record<string, string>;
} | null;

export async function createDrop(
  _prev: CreateResult,
  f: FormData,
): Promise<CreateResult> {
  const edition = s(f, 'editionSize');
  const r = await send('POST', '/admin/drops', {
    number: Number(s(f, 'number')),
    slug: s(f, 'slug'),
    title: s(f, 'title'),
    accentColor: s(f, 'accentColor'),
    editionSize: edition ? Number(edition) : null,
    colourways: f.getAll('colourways').map(String),
    pricePaise: Math.round(Number(s(f, 'price')) * 100),
    description: s(f, 'description'),
  });
  if (!r.ok) return { message: r.message, fields: r.fields ?? {} };
  redirect(`/drops/${s(f, 'slug')}`);
}

export async function updateDrop(f: FormData): Promise<void> {
  const slug = s(f, 'slug');
  const at = (k: string) => (s(f, k) ? new Date(s(f, k)).toISOString() : null);
  const edition = s(f, 'editionSize');
  const body: Record<string, unknown> = {
    title: s(f, 'title'),
    description: s(f, 'description'),
  };
  if (f.get('locked') !== '1') {
    body['accentColor'] = s(f, 'accentColor');
    body['editionSize'] = edition ? Number(edition) : null;
    body['opensAt'] = at('opensAt');
    body['closesAt'] = at('closesAt');
  }
  back(slug, await send('PATCH', `/admin/drops/${slug}`, body), 'Saved.');
}

export async function saveChapters(f: FormData): Promise<void> {
  const slug = s(f, 'slug');
  const keys = f.getAll('key').map(String);
  const chapters = keys.map((key, i) => ({
    key,
    kicker: String(f.getAll('kicker')[i] ?? '').trim(),
    lineOne: String(f.getAll('lineOne')[i] ?? '').trim(),
    lineTwo: String(f.getAll('lineTwo')[i] ?? '').trim(),
  }));
  back(
    slug,
    await send('PUT', `/admin/drops/${slug}/chapters`, chapters),
    'Film copy saved.',
  );
}

export async function saveMappings(f: FormData): Promise<void> {
  const slug = s(f, 'slug');
  const skus = f.getAll('sku').map(String);
  for (const [i, sku] of skus.entries()) {
    const r = await send('PATCH', `/admin/variants/${sku}`, {
      podVariantId: String(f.getAll('podVariantId')[i] ?? '').trim(),
      soldOut: f.getAll('soldOut').map(String).includes(sku),
    });
    if (!r.ok) back(slug, r);
  }
  back(slug, { ok: true }, 'Variants saved.');
}

export async function uploadArtwork(f: FormData): Promise<void> {
  const slug = s(f, 'slug');
  const file = f.get('artwork');
  if (!(file instanceof File) || file.size === 0)
    back(slug, { ok: false, message: 'Choose a PNG first.' });
  const pngBase64 = Buffer.from(await (file as File).arrayBuffer()).toString(
    'base64',
  );
  back(
    slug,
    await send('POST', `/admin/drops/${slug}/artwork`, { pngBase64 }),
    'Artwork uploaded — rendering turntables.',
  );
}

export async function lifecycle(f: FormData): Promise<void> {
  const slug = s(f, 'slug');
  const action = s(f, 'action');
  if (action === 'open')
    back(
      slug,
      await send('POST', `/admin/drops/${slug}/publish`, { mode: 'now' }),
      'The drop is live.',
    );
  if (action === 'schedule')
    back(
      slug,
      await send('POST', `/admin/drops/${slug}/publish`, { mode: 'schedule' }),
      'Scheduled.',
    );
  if (action === 'close')
    back(
      slug,
      await send('POST', `/admin/drops/${slug}/close`),
      'Closed and archived.',
    );
  if (action === 'extend')
    back(
      slug,
      await send('POST', `/admin/drops/${slug}/extend`, {
        hours: Number(s(f, 'hours')),
      }),
      'Extended.',
    );
}
