import { z } from 'zod';

/**
 * The trend radar (FR-20–FR-23, T-074–T-081). Pure: the worker ingests with
 * `normalise` and `isNoise`, the API builds the board with `radar`. Nothing
 * here knows a source's API.
 */
export const TrendSource = z.enum(['hn', 'google_trends', 'reddit', 'youtube']);
export type TrendSource = z.infer<typeof TrendSource>;

/** What an adapter hands the ingest job: the source's own measure, not yet scored. */
export interface Signal {
  source: TrendSource;
  externalId: string;
  term: string;
  url: string | null;
  /** Points, searches, upvotes or views — whatever the source counts. */
  raw: number;
}

/** Scores at or above this count toward the two-source rule (`new-drop` skill §1). */
export const SCORE_LINE = 50;

/**
 * log10 of the raw count that scores 100, per source. Sources count very
 * different things — 400 HN points is a front-page story, 400 searches is
 * nothing — so each is placed on one log scale: HN 100 points ≈ 67,
 * Google Trends 20 000+ searches ≈ 72, Reddit 10 000 upvotes = 80,
 * YouTube 1M views ≈ 86.
 */
const FULL: Record<TrendSource, number> = {
  hn: 3,
  google_trends: 6,
  reddit: 5,
  youtube: 7,
};

export function normalise(source: TrendSource, raw: number): number {
  const s = (100 * Math.log10(Math.max(raw, 1))) / FULL[source];
  return Math.max(0, Math.min(100, Math.round(s)));
}

/**
 * Searches that are trending but are not a moment anyone wears: people
 * logging in, checking a price, a fixture or a horoscope. Found in the live
 * Google Trends IN feed on 14 Oct 2026 ("hk vs sin", "aquarius horoscope
 * today"); most of the feed on a match day is fixtures.
 */
const NOISE = [
  /\blog ?in\b|\bsign ?in\b/,
  /\b(share|stock) price\b|\bnifty\b|\bsensex\b/,
  /\bresults?\b|\badmit card\b|\banswer key\b/,
  /\blive score\b|\bscorecard\b|\bhighlights\b/,
  /\b(vs|v)\b/,
  /\bhoroscope\b|\bweather\b|\blottery\b|\bpanchang\b/,
  /\bholiday\b|\bbank (holiday|closed)\b/,
];

export function isNoise(term: string): boolean {
  const t = term.toLowerCase();
  return NOISE.some((re) => re.test(t));
}

/** Words that join anything to anything — they would corroborate every pair of sources. */
const STOP = new Set(
  (
    'the and for with from that this what when where who why how are was were ' +
    'has have had not but you your its our their his her they them will can ' +
    'new now today news live video official full episode trailer song music ' +
    'india indian 2025 2026 2027 latest update first after about into over ' +
    'just more most why best show ask tell launch launches released release'
  ).split(' '),
);

/** Lower-case words of three or more letters, minus stop words and bare numbers. */
function words(term: string): string[] {
  return term
    .toLowerCase()
    .normalize('NFKC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !STOP.has(w) && !/^\p{N}+$/u.test(w));
}

/** The keys a term can be clustered under: its words, and each adjacent pair of them. */
export function keysOf(term: string): string[] {
  const w = words(term);
  const pairs = w.slice(1).map((b, i) => `${w[i]} ${b}`);
  return [...new Set([...w, ...pairs])];
}

export interface TrendRow {
  id: string;
  source: TrendSource;
  term: string;
  score: number;
  url: string | null;
  seenAt: Date;
}

export interface RadarCluster {
  key: string;
  /** Sum of each source's best score: how loud the moment is everywhere at once. */
  heat: number;
  /** The best trend per source, loudest first. */
  sources: TrendRow[];
  /** Every trend in the window filed under this key — the evidence a promote links. */
  trendIds: string[];
}

/**
 * The board: keys that at least two sources carry above the score line within
 * the window. A key carried by too large a share of all trends is a common
 * word, not a moment, and is dropped. A single word is dropped when a pair
 * containing it has the same sources — "gemini argon" says more than "argon".
 */
export function radar(
  trends: TrendRow[],
  now: Date,
  { windowHours = 24, maxShare = 0.1 } = {},
): RadarCluster[] {
  const since = now.getTime() - windowHours * 3_600_000;
  const recent = trends.filter((t) => t.seenAt.getTime() >= since);
  const byKey = new Map<string, TrendRow[]>();
  for (const t of recent)
    for (const k of keysOf(t.term)) byKey.set(k, [...(byKey.get(k) ?? []), t]);

  const cap = recent.length >= 20 ? recent.length * maxShare : Infinity;
  const clusters: RadarCluster[] = [];
  for (const [key, ts] of byKey) {
    if (ts.length > cap) continue;
    const best = new Map<TrendSource, TrendRow>();
    for (const t of ts) {
      const b = best.get(t.source);
      if (!b || t.score > b.score) best.set(t.source, t);
    }
    const sources = [...best.values()].sort((a, b) => b.score - a.score);
    if (sources.filter((s) => s.score >= SCORE_LINE).length < 2) continue;
    clusters.push({
      key,
      heat: sources.reduce((n, s) => n + s.score, 0),
      sources,
      trendIds: ts.map((t) => t.id),
    });
  }

  const sourceSet = (c: RadarCluster) =>
    c.sources
      .map((s) => s.source)
      .sort()
      .join();
  const pairs = clusters.filter((c) => c.key.includes(' '));
  return clusters
    .filter(
      (c) =>
        c.key.includes(' ') ||
        !pairs.some(
          (p) =>
            p.key.split(' ').includes(c.key) && sourceSet(p) === sourceSet(c),
        ),
    )
    .sort((a, b) => b.heat - a.heat || a.key.localeCompare(b.key));
}

// ------------------------------------------------------------ admin contracts

export const TrendDecision = z.enum([
  'NEW',
  'SHORTLISTED',
  'REJECTED',
  'SHIPPED',
]);

export const RadarSource = z.object({
  source: TrendSource,
  term: z.string(),
  score: z.number().int(),
  url: z.string().nullable(),
});

export const AdminRadarRow = z.object({
  key: z.string(),
  heat: z.number().int(),
  sources: z.array(RadarSource),
  status: TrendDecision,
  dropSlug: z.string().nullable(),
});
export type AdminRadarRow = z.infer<typeof AdminRadarRow>;

export const AdminRadar = z.object({
  rows: z.array(AdminRadarRow),
  /** The loudest single-source trends: worth watching, not yet a drop. */
  watch: z.array(RadarSource.extend({ seenAt: z.string() })),
  /** Every source, and when an ingest last landed anything from it — null is never. */
  sources: z.array(
    z.object({ source: TrendSource, lastSeenAt: z.string().nullable() }),
  ),
});
export type AdminRadar = z.infer<typeof AdminRadar>;

export const DecideTrend = z.object({
  key: z.string().min(1).max(120),
  action: z.enum(['shortlist', 'reject', 'reset']),
});
export type DecideTrend = z.infer<typeof DecideTrend>;

export const PromoteTrend = z.object({ key: z.string().min(1).max(120) });
export type PromoteTrend = z.infer<typeof PromoteTrend>;

/** The ingest job's payload: which source to pull. */
export const TrendIngestJob = z.object({ source: TrendSource });
export type TrendIngestJob = z.infer<typeof TrendIngestJob>;
