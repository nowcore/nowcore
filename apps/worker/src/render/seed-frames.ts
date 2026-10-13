/**
 * Renders the turntables for the seeded drops into apps/web/public/frames.
 *
 *   pnpm exec nx run worker:render-seed
 *
 * Colours here are data — the same garment hexes the db seed writes — not
 * styling, which is why this directory is exempt from the raw-colour rule.
 */
import { join } from 'node:path';
import { typographicArtwork } from './artwork.js';
import { LocalFrameStore } from './frame-store.js';
import { renderColourway } from './render-colourway.js';

const ROOT = join(import.meta.dirname, '../../../web/public/frames');
const store = new LocalFrameStore(ROOT);

const DROPS = [
  {
    slug: 'mediocre-by-design',
    accent: '#D7FF3E',
    line: 'MEDIOCRE BY DESIGN',
    sub: 'DROP 014 / 2026',
    colourways: [
      { code: 'BLK', hex: '#15171B', ink: '#F4F3F0' },
      { code: 'BONE', hex: '#E8E5DE', ink: '#15171B' },
      { code: 'ASH', hex: '#4A4F57', ink: '#F4F3F0' },
      { code: 'MOSS', hex: '#2C3A2E', ink: '#F4F3F0' },
    ],
  },
  {
    slug: 'touch-grass-protocol',
    accent: '#FF6B1A',
    line: 'TOUCH GRASS PROTOCOL',
    sub: 'DROP 013 / 2026',
    colourways: [{ code: 'BLK', hex: '#15171B', ink: '#F4F3F0' }],
  },
];

for (const drop of DROPS) {
  for (const c of drop.colourways) {
    const started = Date.now();
    const artwork = await typographicArtwork({
      wordmark: 'NOWCORE',
      line: drop.line,
      sub: drop.sub,
      ink: c.ink,
      accent: drop.accent,
    });
    const r = await renderColourway(
      { drop: drop.slug, colour: c.code, garmentHex: c.hex, artwork },
      store,
    );
    console.log(
      `${drop.slug}/${c.code.toLowerCase()}`.padEnd(32),
      `desktop ${(r.desktop.bytes / 1024).toFixed(0).padStart(5)} KB  mobile ${(r.mobile.bytes / 1024).toFixed(0).padStart(4)} KB`,
      `  ${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  }
}
