import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Session } from '@nowcore/shared';
import { createApp } from '../../create-app.js';
import { readEnv } from '../../env.js';
import { PrismaService } from '../../prisma.service.js';
import { DropClockService } from './drop-clock.service.js';

/**
 * The drop clock (T-082). Suites share one database and the seed's drop 014
 * is live throughout, so this cannot watch a drop open — that is checked
 * against the running stack (docs/08). It proves the rest: expired drops
 * close, and a due drop stays scheduled while it fails the publish check or
 * another drop is live.
 */
describe('drop clock', () => {
  let app: NestFastifyApplication;
  let db: PrismaService;
  let clock: DropClockService;
  let token = '';
  const base = 600 + Math.floor(Math.random() * 90);
  const slugs = [
    `clock-${base}`,
    `clock-${base + 1}`,
    `clock-${base + 2}`,
  ] as const;
  const as = (method: 'POST' | 'PATCH', url: string, payload: object) =>
    app.inject({
      method,
      url,
      payload,
      headers: { authorization: `Bearer ${token}` },
    });
  const status = async (slug: string) =>
    (await db.drop.findUniqueOrThrow({ where: { slug } })).status;

  /** A drop that passes the publish check, built the way an operator would. */
  async function publishable(number: number, slug: string): Promise<void> {
    await as('POST', '/admin/drops', {
      number,
      slug,
      title: 'Clock Test',
      accentColor: '#FF6B1A',
      editionSize: null,
      colourways: ['blk'],
      pricePaise: 79900,
      description: 'A drop made by the clock suite.',
    });
    const variants = await db.variant.findMany({
      where: { product: { drop: { slug } } },
    });
    for (const v of variants)
      await db.variant.update({
        where: { id: v.id },
        data: {
          podVariantId: `sbx_${v.sku}`,
          sequenceUrl: '/frames/x',
          mockupUrl: '/frames/x/still.avif',
        },
      });
  }

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
    clock = app.get(DropClockService);
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
    for (const [i, slug] of slugs.entries()) await publishable(base + i, slug);
  });

  afterAll(async () => {
    const drops = await db.drop.findMany({
      where: { slug: { in: [...slugs] } },
      include: { products: true },
    });
    for (const d of drops) {
      for (const p of d.products) {
        await db.asset.deleteMany({ where: { productId: p.id } });
        await db.variant.deleteMany({ where: { productId: p.id } });
      }
      await db.product.deleteMany({ where: { dropId: d.id } });
      await db.drop.delete({ where: { id: d.id } });
    }
    await app.close();
  });

  it('closes a live drop whose time is up, and leaves one that is not', async () => {
    const [ended, running] = slugs;
    await db.drop.update({
      where: { slug: ended },
      data: {
        status: 'LIVE',
        opensAt: new Date('2020-01-01'),
        closesAt: new Date(Date.now() - 1000),
      },
    });
    const r = await clock.tick();
    expect(r.closed).toContain(base);
    expect(await status(ended)).toBe('ARCHIVED');
    expect(await status(running)).toBe('DRAFT');
    expect(
      await db.drop.count({
        where: { status: 'LIVE', closesAt: { lte: new Date() } },
      }),
    ).toBe(0);
  });

  it('keeps a due drop scheduled while it fails the publish check', async () => {
    const slug = slugs[1];
    await db.drop.update({
      where: { slug },
      data: { status: 'SCHEDULED', opensAt: new Date(Date.now() - 1000) },
    });
    await db.variant.updateMany({
      where: { product: { drop: { slug } } },
      data: { podVariantId: null },
    });
    const r = await clock.tick();
    expect(r.opened).not.toContain(base + 1);
    expect(r.held[base + 1]).toBe('check');
    expect(await status(slug)).toBe('SCHEDULED');
  });

  it('keeps a publishable due drop scheduled while another drop is live', async () => {
    expect(await db.drop.count({ where: { status: 'LIVE' } })).toBeGreaterThan(
      0,
    );
    const slug = slugs[2];
    await db.drop.update({
      where: { slug },
      data: { status: 'SCHEDULED', opensAt: new Date(Date.now() - 1000) },
    });
    const r = await clock.tick();
    expect(r.opened).toEqual([]);
    expect(r.held[base + 2]).toBe('live');
    expect(await status(slug)).toBe('SCHEDULED');
  });
});
