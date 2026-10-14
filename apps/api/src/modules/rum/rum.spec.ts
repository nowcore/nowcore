import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AdminRum, Session } from '@nowcore/shared';
import { createApp } from '../../create-app.js';
import { readEnv } from '../../env.js';
import { PrismaService } from '../../prisma.service.js';

/** Field performance (T-094): beacons in, a summary out. Routes unique to this run. */
describe('rum', () => {
  let app: NestFastifyApplication;
  let db: PrismaService;
  let token = '';
  const route = `/rum-test-${Date.now()}`;

  beforeAll(async () => {
    app = await createApp(
      readEnv({
        RECONCILE: 'off',
        QUEUE_PREFIX: 'test-api',
        DROP_CLOCK: 'off',
        RATE_LIMIT: 'off',
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
  });
  afterAll(async () => {
    await db.rumSample.deleteMany({ where: { route } });
    await app.close();
  });

  const send = (payload: object) =>
    app.inject({ method: 'POST', url: '/rum', payload });

  it('stores a beacon as one row per metric, and nothing that identifies the visitor', async () => {
    const res = await send({
      route,
      tier: 'full',
      cores: 8,
      memory: 8,
      net: '4g',
      mobile: true,
      metrics: [
        { name: 'LCP', value: 1200 },
        { name: 'SCROLL_FT95', value: 16.7 },
      ],
    });
    expect(res.statusCode).toBe(204);
    const rows = await db.rumSample.findMany({ where: { route } });
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.beacon)).size).toBe(1);
    expect(rows.find((r) => r.metric === 'SCROLL_FT95')).toMatchObject({
      value: 16700,
      memoryMb: 8192,
    });
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual(
      [
        'beacon',
        'cores',
        'createdAt',
        'id',
        'memoryMb',
        'metric',
        'mobile',
        'net',
        'route',
        'tier',
        'value',
      ].sort(),
    );
  });

  it('refuses junk: a URL with a query, an unknown metric, an absurd value', async () => {
    const base = {
      route,
      tier: 'full',
      mobile: false,
      metrics: [{ name: 'LCP', value: 900 }],
    };
    expect(
      (await send({ ...base, route: '/order/NC-1?t=secret' })).statusCode,
    ).toBe(400);
    expect(
      (await send({ ...base, metrics: [{ name: 'FPS', value: 60 }] }))
        .statusCode,
    ).toBe(400);
    expect(
      (await send({ ...base, metrics: [{ name: 'LCP', value: 1e9 }] }))
        .statusCode,
    ).toBe(400);
  });

  it('summarises p75 per metric and segment, scroll as fps, for operators only', async () => {
    // Three slow low-end views and one fast full one.
    for (const ft of [33.3, 33.3, 33.3])
      await send({
        route,
        tier: 'reduced',
        cores: 4,
        mobile: true,
        metrics: [{ name: 'SCROLL_FT95', value: ft }],
      });
    expect(
      (await app.inject({ method: 'GET', url: '/admin/rum' })).statusCode,
    ).toBe(401);
    const sum = AdminRum.parse(
      (
        await app.inject({
          method: 'GET',
          url: '/admin/rum?days=1',
          headers: { authorization: `Bearer ${token}` },
        })
      ).json(),
    );
    expect(sum.table.SCROLL_FT95?.['low-end']?.value).toBe(30);
    expect(sum.table.SCROLL_FT95?.reduced?.samples).toBeGreaterThanOrEqual(3);
    expect(sum.pageViews).toBeGreaterThanOrEqual(4);
  });
});
