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

/** Closed drops for the archive chapter, newest first. Mirrors the seed + canvas. */
export interface ArchivedDrop {
  number: number;
  slug: string;
  title: string;
  closedOn: string;
}

export const archive: ArchivedDrop[] = [
  {
    number: 13,
    slug: 'touch-grass-protocol',
    title: 'Touch Grass Protocol',
    closedOn: '2026-09-28',
  },
  {
    number: 12,
    slug: 'vibe-debugging',
    title: 'Vibe Debugging',
    closedOn: '2026-09-14',
  },
  {
    number: 11,
    slug: 'offline-maxxing',
    title: 'Offline Maxxing',
    closedOn: '2026-08-31',
  },
  {
    number: 10,
    slug: 'slow-web-society',
    title: 'Slow Web Society',
    closedOn: '2026-08-17',
  },
  {
    number: 9,
    slug: 'inbox-zero-is-fake',
    title: 'Inbox Zero Is Fake',
    closedOn: '2026-08-03',
  },
];

/** What the radar is seeing. Replaced by the trends API (T-080). */
export const trends = [
  { source: 'RDT', term: 'mediocre by design', score: 98 },
  { source: 'GT', term: 'touch grass', score: 91 },
  { source: 'HN', term: 'vibe debugging', score: 84 },
  { source: 'YT', term: 'desk setup 2026', score: 71 },
  { source: 'RDT', term: 'offline maxxing', score: 66 },
  { source: 'GT', term: 'slow web', score: 58 },
  { source: 'HN', term: 'post-agentic', score: 47 },
  { source: 'YT', term: 'analog revival', score: 39 },
];

/** Wall placeholders until UGC submission lands (T-090). */
export const wall = [
  '@arnvsh',
  '@thedailyloop',
  '@kbr.jpg',
  '@noisefloor',
  '@sreeja.exe',
  '@lowfi.anand',
];
