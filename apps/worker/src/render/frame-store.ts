import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ObjectStore } from '@nowcore/storage';

/**
 * Where rendered frames go: a local directory the API serves at /frames
 * (dev and tests), or Supabase Storage via ObjectFrameStore (hosted, T-035).
 * Same keys and the same returned paths either way, so switching is a binding
 * change (STORAGE=supabase), not a code change.
 */
export interface FrameStore {
  /** Writes `bytes` at `key` and returns the public URL path. */
  put(key: string, bytes: Buffer): Promise<string>;
}

export class LocalFrameStore implements FrameStore {
  constructor(
    private readonly root: string,
    private readonly publicPrefix = '/frames',
  ) {}

  async put(key: string, bytes: Buffer): Promise<string> {
    if (key.includes('..') || key.startsWith('/'))
      throw new Error(`unsafe key: ${key}`);
    const path = join(this.root, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
    return `${this.publicPrefix}/${key}`;
  }
}

/** Frame budgets per colourway (docs/10). Over budget is a failed render. */
export const FRAME_BUDGET = {
  desktop: 3.0 * 1024 * 1024,
  mobile: 1.2 * 1024 * 1024,
} as const;

export const frameKey = (
  drop: string,
  colour: string,
  set: 'd' | 'm',
  i: number,
) =>
  `${drop}/${colour.toLowerCase()}/${set}/f${String(i).padStart(2, '0')}.avif`;
export const stillKey = (drop: string, colour: string) =>
  `${drop}/${colour.toLowerCase()}/still.avif`;

/**
 * Frames in object storage (Supabase bucket "frames", public). The returned
 * path is the same `/frames/<key>` the local store gives, so the database and
 * the API's URL building do not change — only ASSET_BASE_URL points at the
 * bucket's public URL instead of the API.
 */
export class ObjectFrameStore implements FrameStore {
  constructor(private readonly store: ObjectStore) {}

  async put(key: string, bytes: Buffer): Promise<string> {
    const type = key.endsWith('.avif')
      ? 'image/avif'
      : key.endsWith('.png')
        ? 'image/png'
        : 'application/octet-stream';
    await this.store.put(key, bytes, type);
    return `/frames/${key}`;
  }
}
