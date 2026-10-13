/** Hex mixing for fabric shading. Garment colours are data from the variant. */
export function mix(
  hex: string,
  toward: 'white' | 'black',
  amount: number,
): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const target = toward === 'white' ? 255 : 0;
  const ch = (v: number) => Math.round(v + (target - v) * amount);
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Relative luminance — decides whether the garment needs light or dark edges. */
export function isLight(hex: string): boolean {
  const n = parseInt(hex.replace('#', ''), 16);
  const lum =
    0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return lum > 140;
}
