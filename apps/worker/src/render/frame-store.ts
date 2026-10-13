import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Where rendered frames go. Production is Supabase Storage (T-035), which
 * needs the hosted project the operator will share; until then frames are
 * written to a directory the web app serves statically. Same keys either way,
 * so switching is a binding change, not a code change.
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
