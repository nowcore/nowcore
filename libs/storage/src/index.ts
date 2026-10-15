import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Where uploaded artwork and rendered frames live (T-035). One interface, two
 * places: the local disk (`.storage/`, dev and tests) and Supabase Storage
 * (hosted). The API writes artwork; the worker reads it and writes frames.
 * Keys are relative paths like `mediocre-by-design/blk-1a2b/d/f00.avif`.
 */
export interface ObjectStore {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
}

/** Refuses keys that could climb out of their bucket or folder. */
function safe(key: string): string {
  if (!key || key.includes('..') || key.startsWith('/') || key.includes('\\'))
    throw new Error(`unsafe storage key: ${key}`);
  return key;
}

export class LocalStore implements ObjectStore {
  constructor(private readonly root: string) {}

  async put(key: string, bytes: Buffer, _contentType?: string): Promise<void> {
    const path = join(this.root, safe(key));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(join(this.root, safe(key)));
  }
}

/**
 * Supabase Storage over its REST API, with the secret key — server-side only
 * (this lib is scope:server; the storefront cannot import it). Writes are
 * upserts; every frame revision has a new path, so objects are cached as
 * immutable for a year.
 */
export class SupabaseStore implements ObjectStore {
  constructor(
    private readonly url: string,
    private readonly secretKey: string,
    private readonly bucket: string,
    private readonly f: typeof fetch = fetch,
  ) {}

  private object(key: string): string {
    return `${this.url}/storage/v1/object/${this.bucket}/${safe(key)}`;
  }

  private headers(): Record<string, string> {
    return {
      apikey: this.secretKey,
      authorization: `Bearer ${this.secretKey}`,
    };
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    const res = await this.f(this.object(key), {
      method: 'POST',
      headers: {
        ...this.headers(),
        'content-type': contentType,
        'cache-control': 'max-age=31536000, immutable',
        'x-upsert': 'true',
      },
      body: new Uint8Array(bytes),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok)
      throw new Error(
        `storage put ${this.bucket}/${key}: ${res.status} ${await res.text()}`,
      );
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.f(this.object(key), {
      headers: this.headers(),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok)
      throw new Error(`storage get ${this.bucket}/${key}: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
