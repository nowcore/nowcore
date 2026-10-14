/** A stored asset path (`/frames/…`) as a URL a browser can load. Absolute URLs pass through. */
export function assetUrl(base: string, path: string): string;
export function assetUrl(base: string, path: string | null): string | null;
export function assetUrl(base: string, path: string | null): string | null {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : `${base.replace(/\/$/, '')}${path}`;
}
