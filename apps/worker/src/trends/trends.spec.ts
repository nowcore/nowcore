import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { QueueEvents, type Queue } from 'bullmq';
import { QUEUE } from '@nowcore/shared';
import { readEnv, redisConnection } from '../env.js';
import { PrismaService } from '../prisma.service.js';
import { TREND_FETCH } from '../tokens.js';
import { WorkerModule } from '../worker.module.js';
import { configured, parseTrendsRss, pull, type Fetch } from './sources.js';

/**
 * Ingest against canned responses shaped like the live ones of 14 Oct 2026.
 * Ids are unique per run: a developer's worker may be ingesting the real
 * feeds into the same database.
 */
const tag = `t${Date.now()}`;
const hnPage = (points: number) => ({
  hits: [
    { objectID: `${tag}-1`, title: 'Gemini 4 Argon', points },
    { objectID: `${tag}-2`, title: null, points: 10 },
  ],
});
const rss = `<?xml version="1.0"?><rss><channel>
<item><title>${tag} kisan yojana</title><ht:approx_traffic>2,000+</ht:approx_traffic>
<ht:news_item_url>https://example.test/a?x=1&amp;y=2</ht:news_item_url></item>
<item><title>hk vs sin ${tag}</title><ht:approx_traffic>2000+</ht:approx_traffic></item>
</channel></rss>`;

function fakeFetch(routes: Record<string, unknown>): Fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    const hit = Object.entries(routes).find(([k]) => url.startsWith(k));
    if (!hit) return new Response('no route', { status: 404 });
    const body = hit[1];
    return new Response(
      typeof body === 'string' ? body : JSON.stringify(body),
      { status: 200 },
    );
  }) as Fetch;
}

describe('trend sources', () => {
  it('reads Google Trends RSS: traffic as a number, entities decoded', () => {
    const [a] = parseTrendsRss(rss);
    expect(a).toMatchObject({
      term: `${tag} kisan yojana`,
      raw: 2000,
      url: 'https://example.test/a?x=1&y=2',
    });
  });

  it('schedules Reddit and YouTube only with their credentials', () => {
    expect(configured({})).toEqual(['hn', 'google_trends']);
    expect(
      configured({
        REDDIT_CLIENT_ID: 'a',
        REDDIT_CLIENT_SECRET: 'b',
        YOUTUBE_API_KEY: 'k',
      }),
    ).toEqual(['hn', 'google_trends', 'reddit', 'youtube']);
  });

  it('maps Reddit and YouTube responses (documented shapes; unverified live)', async () => {
    const f = fakeFetch({
      'https://www.reddit.com/api/v1/access_token': { access_token: 'tok' },
      'https://oauth.reddit.com/r/popular': {
        data: {
          children: [
            {
              data: {
                id: 'r1',
                title: 'Cockroach Janta Party',
                ups: 12000,
                permalink: '/r/india/x',
              },
            },
          ],
        },
      },
      'https://www.googleapis.com/youtube/v3/videos': {
        items: [
          {
            id: 'v1',
            snippet: { title: 'Gemini Argon explained' },
            statistics: { viewCount: '1200000' },
          },
        ],
      },
    });
    const creds = {
      REDDIT_CLIENT_ID: 'a',
      REDDIT_CLIENT_SECRET: 'b',
      YOUTUBE_API_KEY: 'k',
    };
    expect(await pull('reddit', f, creds)).toEqual([
      {
        source: 'reddit',
        externalId: 'r1',
        term: 'Cockroach Janta Party',
        url: 'https://www.reddit.com/r/india/x',
        raw: 12000,
      },
    ]);
    expect((await pull('youtube', f, creds))[0]).toMatchObject({
      externalId: 'v1',
      raw: 1_200_000,
    });
  });

  it('fails loudly when a source changes shape', async () => {
    await expect(
      pull('hn', fakeFetch({ 'https://hn.algolia.com': { results: [] } }), {}),
    ).rejects.toThrow();
  });
});

describe('trends.ingest', () => {
  const env = readEnv({
    QUEUE_PREFIX: `test-${Math.random().toString(36).slice(2, 10)}`,
    TRENDS: 'off',
  });
  const routes: Record<string, unknown> = {
    'https://hn.algolia.com': hnPage(400),
    'https://trends.google.com': rss,
  };
  let db: PrismaService;
  let queue: Queue;
  let events: QueueEvents;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [WorkerModule.with(env)],
    })
      .overrideProvider(TREND_FETCH)
      .useValue(fakeFetch(routes))
      .compile();
    const app = await mod.init();
    close = () => app.close();
    db = app.get(PrismaService);
    queue = app.get(getQueueToken(QUEUE.trends));
    events = new QueueEvents(QUEUE.trends, {
      connection: redisConnection(env.REDIS_URL),
      prefix: env.QUEUE_PREFIX,
    });
    await events.waitUntilReady();
  });
  afterAll(async () => {
    await db.trend.deleteMany({
      where: {
        OR: [{ externalId: { contains: tag } }, { term: { contains: tag } }],
      },
    });
    await events.close();
    await close();
  });

  let runs = 0;
  const run = async (source: 'hn' | 'google_trends') =>
    (
      await queue.add(
        source,
        { source },
        { jobId: `${source}-${tag}-${++runs}` },
      )
    ).waitUntilFinished(events, 8000) as Promise<{
      landed: number;
      noise: number;
    }>;
  const mine = () =>
    db.trend.findMany({
      where: {
        OR: [{ externalId: { contains: tag } }, { term: { contains: tag } }],
      },
      orderBy: { source: 'asc' },
    });

  it('lands scored signals and leaves out the noise', async () => {
    expect(await run('hn')).toEqual({ landed: 1, noise: 0 });
    expect(await run('google_trends')).toEqual({ landed: 1, noise: 1 });
    const rows = await mine();
    expect(rows.map((r) => [r.source, r.score])).toEqual([
      ['google_trends', 55],
      ['hn', 87],
    ]);
  });

  it('a story seen again is the same row, rescored and re-sighted, first sighting kept', async () => {
    const [before] = (await mine()).filter((r) => r.source === 'hn');
    routes['https://hn.algolia.com'] = hnPage(1000);
    await run('hn');
    const after = (await mine()).filter((r) => r.source === 'hn');
    expect(after).toHaveLength(1);
    expect(after[0]?.score).toBe(100);
    expect(after[0]?.capturedAt).toEqual(before?.capturedAt);
    expect(after[0]?.seenAt.getTime()).toBeGreaterThan(
      before?.seenAt.getTime() ?? Infinity,
    );
  });
});
