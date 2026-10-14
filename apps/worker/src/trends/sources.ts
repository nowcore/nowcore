import { z } from 'zod';
import type { Signal, TrendSource } from '@nowcore/shared';

/**
 * One adapter per radar source (T-075–T-078). Each makes one request per run
 * — hourly, far inside every published limit (NFR-10) — and returns what the
 * source counts, unscored. Responses are parsed with zod: a source changing
 * its shape fails the run loudly instead of filling the radar with blanks.
 *
 * HN and Google Trends need no credentials and were checked live on
 * 14 Oct 2026. Reddit (OAuth app) and YouTube (API key) are written to their
 * documented APIs and are unverified until credentials exist; without them
 * the job for that source is not scheduled at all.
 */
export type Fetch = typeof fetch;
export interface SourceCredentials {
  REDDIT_CLIENT_ID?: string | undefined;
  REDDIT_CLIENT_SECRET?: string | undefined;
  YOUTUBE_API_KEY?: string | undefined;
}

const UA = 'nowcore-radar/1.0 (trend ingest; one request per hour)';

async function json(
  f: Fetch,
  url: string,
  init: RequestInit = {},
): Promise<unknown> {
  const res = await f(url, {
    ...init,
    headers: { 'user-agent': UA, ...init.headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${new URL(url).host}: ${res.status}`);
  return res.json();
}

const HnPage = z.object({
  hits: z.array(
    z.object({
      objectID: z.string(),
      title: z.string().nullable(),
      points: z.number().nullable(),
    }),
  ),
});

async function hn(f: Fetch): Promise<Signal[]> {
  const page = HnPage.parse(
    await json(
      f,
      'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=50',
    ),
  );
  return page.hits
    .filter((h) => h.title)
    .map((h) => ({
      source: 'hn' as const,
      externalId: h.objectID,
      term: h.title as string,
      url: `https://news.ycombinator.com/item?id=${h.objectID}`,
      raw: h.points ?? 0,
    }));
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};
function unescape(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) =>
      e.startsWith('#x') || e.startsWith('#X')
        ? String.fromCodePoint(parseInt(e.slice(2), 16))
        : e.startsWith('#')
          ? String.fromCodePoint(Number(e.slice(1)))
          : (ENTITIES[e.toLowerCase()] ?? m),
    )
    .trim();
}
const tag = (item: string, name: string) =>
  item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1];

/** Google Trends' daily trending searches for India, as RSS. "2,000+" searches → 2000. */
export function parseTrendsRss(xml: string): Signal[] {
  return xml
    .split('<item>')
    .slice(1)
    .flatMap((item) => {
      const title = tag(item, 'title');
      if (!title) return [];
      const term = unescape(title);
      const traffic = Number(
        (tag(item, 'ht:approx_traffic') ?? '0').replace(/[^\d]/g, ''),
      );
      const news = tag(item, 'ht:news_item_url');
      return [
        {
          source: 'google_trends' as const,
          // The same search trends for days; one row per search, its last sighting refreshed.
          externalId: term.toLowerCase(),
          term,
          url: news ? unescape(news) : null,
          raw: traffic,
        },
      ];
    });
}

async function googleTrends(f: Fetch): Promise<Signal[]> {
  const res = await f('https://trends.google.com/trending/rss?geo=IN', {
    headers: { 'user-agent': UA },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`trends.google.com: ${res.status}`);
  return parseTrendsRss(await res.text());
}

const RedditToken = z.object({ access_token: z.string() });
const RedditListing = z.object({
  data: z.object({
    children: z.array(
      z.object({
        data: z.object({
          id: z.string(),
          title: z.string(),
          ups: z.number(),
          permalink: z.string(),
        }),
      }),
    ),
  }),
});

/** r/popular for India, app-only OAuth — reddit.com refuses unauthenticated JSON (403, 14 Oct 2026). */
async function reddit(f: Fetch, c: SourceCredentials): Promise<Signal[]> {
  const basic = Buffer.from(
    `${c.REDDIT_CLIENT_ID}:${c.REDDIT_CLIENT_SECRET}`,
  ).toString('base64');
  const { access_token } = RedditToken.parse(
    await json(f, 'https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        authorization: `Basic ${basic}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    }),
  );
  const page = RedditListing.parse(
    await json(
      f,
      'https://oauth.reddit.com/r/popular/hot?geo_filter=IN&limit=50',
      {
        headers: { authorization: `Bearer ${access_token}` },
      },
    ),
  );
  return page.data.children.map(({ data: p }) => ({
    source: 'reddit' as const,
    externalId: p.id,
    term: p.title,
    url: `https://www.reddit.com${p.permalink}`,
    raw: p.ups,
  }));
}

const YoutubePage = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      snippet: z.object({ title: z.string() }),
      statistics: z.object({ viewCount: z.string().optional() }),
    }),
  ),
});

/** YouTube's most-popular chart for India. One call costs 1 quota unit of the daily 10 000. */
async function youtube(f: Fetch, c: SourceCredentials): Promise<Signal[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.search = new URLSearchParams({
    part: 'snippet,statistics',
    chart: 'mostPopular',
    regionCode: 'IN',
    maxResults: '50',
    key: c.YOUTUBE_API_KEY ?? '',
  }).toString();
  const page = YoutubePage.parse(await json(f, url.toString()));
  return page.items.map((v) => ({
    source: 'youtube' as const,
    externalId: v.id,
    term: v.snippet.title,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    raw: Number(v.statistics.viewCount ?? 0),
  }));
}

/** The sources that can run with these credentials. */
export function configured(c: SourceCredentials): TrendSource[] {
  return [
    'hn',
    'google_trends',
    ...(c.REDDIT_CLIENT_ID && c.REDDIT_CLIENT_SECRET
      ? (['reddit'] as const)
      : []),
    ...(c.YOUTUBE_API_KEY ? (['youtube'] as const) : []),
  ];
}

export function pull(
  source: TrendSource,
  f: Fetch,
  c: SourceCredentials,
): Promise<Signal[]> {
  switch (source) {
    case 'hn':
      return hn(f);
    case 'google_trends':
      return googleTrends(f);
    case 'reddit':
      return reddit(f, c);
    case 'youtube':
      return youtube(f, c);
  }
}
