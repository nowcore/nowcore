import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStore, SupabaseStore } from './index.js';

describe('LocalStore', () => {
  const store = new LocalStore(mkdtempSync(join(tmpdir(), 'nc-store-')));
  it('round-trips bytes and refuses keys that climb out', async () => {
    await store.put('a/b/c.png', Buffer.from('hello'), 'image/png');
    expect((await store.get('a/b/c.png')).toString()).toBe('hello');
    await expect(
      store.put('../escape.png', Buffer.from('x'), 'image/png'),
    ).rejects.toThrow(/unsafe/);
    await expect(store.get('/etc/passwd')).rejects.toThrow(/unsafe/);
  });
});

describe('SupabaseStore', () => {
  it('upserts with the secret key and immutable caching, and reads back', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      return init.method === 'POST'
        ? new Response('{}', { status: 200 })
        : new Response('bytes', { status: 200 });
    }) as unknown as typeof fetch;
    const s = new SupabaseStore(
      'https://x.supabase.co',
      'sb_secret_test',
      'frames',
      f,
    );
    await s.put('drop/blk/f00.avif', Buffer.from('img'), 'image/avif');
    expect(calls[0]?.url).toBe(
      'https://x.supabase.co/storage/v1/object/frames/drop/blk/f00.avif',
    );
    expect(calls[0]?.init.headers).toMatchObject({
      authorization: 'Bearer sb_secret_test',
      'content-type': 'image/avif',
      'x-upsert': 'true',
      'cache-control': 'max-age=31536000, immutable',
    });
    expect((await s.get('drop/blk/f00.avif')).toString()).toBe('bytes');
  });

  it('fails loudly on a refused write, and refuses unsafe keys before calling out', async () => {
    const f = (async () =>
      new Response('nope', { status: 403 })) as unknown as typeof fetch;
    const s = new SupabaseStore('https://x.supabase.co', 'k', 'frames', f);
    await expect(
      s.put('a.avif', Buffer.from('x'), 'image/avif'),
    ).rejects.toThrow(/403/);
    await expect(s.get('../other-bucket/x')).rejects.toThrow(/unsafe/);
  });
});
