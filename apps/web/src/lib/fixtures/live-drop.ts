/**
 * The live drop, as the catalogue API will return it (T-045). Mirrors the db
 * seed exactly so the film can be built and measured before the API exists.
 * Delete this file when `GET /drops/live` lands — nothing else should import it
 * by then.
 */
export interface FilmColourway {
  code: string;
  name: string;
}

export interface LiveDrop {
  number: number;
  slug: string;
  title: string;
  accent: string;
  closesAt: string;
  editionSize: number;
  claimed: number;
  pricePaise: number;
  colourways: FilmColourway[];
}

export const liveDrop: LiveDrop = {
  number: 14,
  slug: 'mediocre-by-design',
  title: 'Mediocre By Design',
  accent: '#D7FF3E',
  // Fixed so the build is deterministic; the API makes it live.
  closesAt: '2026-10-16T18:29:00.000Z',
  editionSize: 500,
  claimed: 240,
  pricePaise: 79900,
  colourways: [
    { code: 'blk', name: 'Void black' },
    { code: 'bone', name: 'Bone' },
    { code: 'ash', name: 'Ash grey' },
    { code: 'moss', name: 'Deep moss' },
  ],
};

const pad = (i: number) => String(i).padStart(2, '0');

/** Frame URLs written by `nx run worker:render-seed` (apps/worker/src/render). */
export function framesFor(drop: string, colour: string) {
  const base = `/frames/${drop}/${colour}`;
  return {
    still: `${base}/still.avif`,
    full: Array.from({ length: 72 }, (_, i) => `${base}/d/f${pad(i)}.avif`),
    reduced: Array.from({ length: 24 }, (_, i) => `${base}/m/f${pad(i)}.avif`),
    width: 800,
    height: 992,
  };
}
