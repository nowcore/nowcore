import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AdminRadar, Session } from '@nowcore/shared';
import { createApp } from '../../create-app.js';
import { readEnv } from '../../env.js';
import { PrismaService } from '../../prisma.service.js';

/** The radar board and promote (T-079–T-081). Words unique to this run, so real ingested trends cannot collide. */
describe('admin trends', () => {
  let app: NestFastifyApplication;
  let db: PrismaService;
  let token = '';
  const word = `zq${Math.random().toString(36).slice(2, 8)}`;
  const key = `${word} argon`;
  const lone = `${word}solo`;

  const as = (method: 'GET' | 'POST', url: string, payload?: object) =>
    app.inject({
      method,
      url,
      ...(payload ? { payload } : {}),
      headers: { authorization: `Bearer ${token}` },
    });
  const board = async () =>
    AdminRadar.parse((await as('GET', '/admin/trends')).json());
  const row = async () => (await board()).rows.find((r) => r.key === key);

  beforeAll(async () => {
    app = await createApp(
      readEnv({
        RECONCILE: 'off',
        QUEUE_PREFIX: 'test-api',
        DROP_CLOCK: 'off',
      }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get(PrismaService);
    token = Session.parse(
      (
        await app.inject({
          method: 'POST',
          url: '/admin/session',
          payload: {
            email: 'admin@nowcore.local',
            password: 'nowcore-local-admin',
          },
        })
      ).json(),
    ).token;
    const now = new Date();
    await db.trend.createMany({
      data: [
        {
          source: 'hn',
          externalId: `${word}-1`,
          term: `${word} Argon is here`,
          score: 90,
          capturedAt: now,
          seenAt: now,
        },
        {
          source: 'hn',
          externalId: `${word}-2`,
          term: `Why ${word} argon matters`,
          score: 60,
          capturedAt: now,
          seenAt: now,
        },
        {
          source: 'google_trends',
          externalId: `${word}-3`,
          term: `${word} argon`,
          score: 70,
          capturedAt: now,
          seenAt: now,
        },
        {
          source: 'reddit',
          externalId: `${word}-4`,
          term: `${lone} thread`,
          score: 95,
          capturedAt: now,
          seenAt: now,
        },
      ],
    });
  });

  afterAll(async () => {
    const cluster = await db.trendCluster.findUnique({ where: { key } });
    await db.trend.deleteMany({ where: { externalId: { startsWith: word } } });
    await db.trendCluster.deleteMany({ where: { key } });
    if (cluster?.dropId) {
      const products = await db.product.findMany({
        where: { dropId: cluster.dropId },
      });
      for (const p of products)
        await db.variant.deleteMany({ where: { productId: p.id } });
      await db.product.deleteMany({ where: { dropId: cluster.dropId } });
      await db.drop.delete({ where: { id: cluster.dropId } });
    }
    await app.close();
  });

  it('boards a signal two sources carry, with the best of each, and nothing one source carries', async () => {
    const r = await row();
    expect(r).toMatchObject({ status: 'NEW', heat: 160, dropSlug: null });
    expect(r?.sources.map((s) => [s.source, s.score])).toEqual([
      ['hn', 90],
      ['google_trends', 70],
    ]);
    expect((await board()).rows.some((x) => x.key.includes(lone))).toBe(false);
  });

  it('refuses to promote what only one source carries', async () => {
    const res = await as('POST', '/admin/trends/promote', { key: lone });
    expect(res.statusCode).toBe(404);
    expect(res.json().message).toMatch(/two sources/);
  });

  it('shortlists, rejects and resets a signal', async () => {
    for (const [action, status] of [
      ['shortlist', 'SHORTLISTED'],
      ['reject', 'REJECTED'],
      ['reset', 'NEW'],
    ] as const) {
      expect(
        (await as('POST', '/admin/trends/decide', { key, action })).statusCode,
      ).toBe(204);
      expect((await row())?.status).toBe(status);
    }
  });

  it('promotes to a draft drop carrying every trend under the key as evidence, once', async () => {
    const res = await as('POST', '/admin/trends/promote', { key });
    expect(res.statusCode).toBe(201);
    const { slug } = res.json() as { slug: string };
    expect(slug).toMatch(new RegExp(`^${word}-argon-\\d+$`));
    const drop = await db.drop.findUniqueOrThrow({
      where: { slug },
      include: { trends: true },
    });
    expect(drop.status).toBe('DRAFT');
    expect(drop.title).toBe(`${word[0]?.toUpperCase()}${word.slice(1)} Argon`);
    expect(drop.trends.map((t) => t.externalId).sort()).toEqual([
      `${word}-1`,
      `${word}-2`,
      `${word}-3`,
    ]);
    expect(drop.trends.every((t) => t.status === 'SHIPPED')).toBe(true);
    const detail = (await as('GET', `/admin/drops/${slug}`)).json() as {
      evidence: { source: string; score: number }[];
    };
    expect(detail.evidence.map((e) => e.score)).toEqual([90, 70, 60]);
    expect(await row()).toMatchObject({ status: 'SHIPPED', dropSlug: slug });

    expect(
      (await as('POST', '/admin/trends/promote', { key })).statusCode,
    ).toBe(409);
    expect(
      (await as('POST', '/admin/trends/decide', { key, action: 'reject' }))
        .statusCode,
    ).toBe(409);
  });

  it('needs an operator', async () => {
    expect(
      (await app.inject({ method: 'GET', url: '/admin/trends' })).statusCode,
    ).toBe(401);
  });
});
