import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AdminDropDetail, Session } from '@nowcore/shared';
import { createApp } from '../../create-app.js';
import { readEnv } from '../../env.js';
import { PrismaService } from '../../prisma.service.js';

/** A PNG header with the given size — enough for the upload check, which reads only the IHDR. */
function png(width: number, height: number): string {
  const b = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12);
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b.toString('base64');
}

describe('admin drops', () => {
  let app: NestFastifyApplication;
  let db: PrismaService;
  let token = '';
  const number = 800 + Math.floor(Math.random() * 99);
  const slug = `test-drop-${number}`;

  const as = (
    method: 'GET' | 'POST' | 'PATCH' | 'PUT',
    url: string,
    payload?: unknown,
  ) =>
    app.inject({
      method,
      url,
      ...(payload !== undefined ? { payload: payload as object } : {}),
      headers: { authorization: `Bearer ${token}` },
    });
  const detail = async () =>
    AdminDropDetail.parse((await as('GET', `/admin/drops/${slug}`)).json());

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
    const d = await db.drop.findUnique({
      where: { slug },
      include: { products: true },
    });
    if (d) {
      for (const p of d.products) {
        await db.asset.deleteMany({ where: { productId: p.id } });
        await db.variant.deleteMany({ where: { productId: p.id } });
      }
      await db.product.deleteMany({ where: { dropId: d.id } });
      await db.drop.delete({ where: { id: d.id } });
    }
    await app.close();
  });

  it('creates a draft drop with a variant per colourway and size', async () => {
    const res = await as('POST', '/admin/drops', {
      number,
      slug,
      title: 'Test Drop',
      accentColor: '#3A3A80',
      editionSize: 200,
      colourways: ['blk', 'bone'],
      pricePaise: 79900,
      description: 'A drop made by the test suite.',
    });
    expect(res.statusCode).toBe(201);
    const d = await detail();
    expect(d.status).toBe('DRAFT');
    expect(d.variants).toHaveLength(14);
    expect(d.variants.find((v) => v.size === '2XL')?.pricePaise).toBe(84900);
    expect(d.chapters).toHaveLength(7);
    expect(d.variants[0]?.sku).toMatch(new RegExp(`^NC-${number}-TEE-`));
  });

  it('refuses a duplicate number or slug', async () => {
    const res = await as('POST', '/admin/drops', {
      number,
      slug: 'something-else',
      title: 'Dup',
      accentColor: '#D7FF3E',
      editionSize: null,
      colourways: ['blk'],
      pricePaise: 79900,
      description: 'Duplicate number.',
    });
    expect(res.statusCode).toBe(409);
  });

  it('names every reason the drop cannot open', async () => {
    const d = await detail();
    const text = d.problemList.join('\n');
    expect(text).toMatch(/14 variant\(s\) are not mapped/);
    expect(text).toMatch(
      /No turntable yet for: Bone, Void black|No turntable yet for: Void black, Bone/,
    );
    expect(text).toMatch(/Accent #3A3A80/);
    expect(
      (await as('POST', `/admin/drops/${slug}/publish`, { mode: 'now' }))
        .statusCode,
    ).toBe(409);
  });

  it('checks artwork by its bytes and size before storing it', async () => {
    expect(
      (
        await as('POST', `/admin/drops/${slug}/artwork`, {
          pngBase64: Buffer.from('GIF89a not a png at all').toString('base64'),
        })
      ).json().message,
    ).toMatch(/must be a PNG/);
    expect(
      (
        await as('POST', `/admin/drops/${slug}/artwork`, {
          pngBase64: png(400, 400),
        })
      ).json().message,
    ).toMatch(/400×400/);
    const ok = await as('POST', `/admin/drops/${slug}/artwork`, {
      pngBase64: png(1200, 1200),
    });
    expect(ok.json()).toEqual({ jobs: 2 });
    expect((await detail()).product?.hasArtwork).toBe(true);
  });

  it('maps variants, flags ids the printer does not stock, and passes once fixed', async () => {
    const skus = (await detail()).variants.map((v) => v.sku);
    for (const sku of skus)
      await as('PATCH', `/admin/variants/${sku}`, {
        podVariantId: `sbx_${sku}`,
      });
    await as('PATCH', `/admin/variants/${skus[0]}`, {
      podVariantId: 'printrove_999',
    });
    expect((await detail()).problemList.join('\n')).toMatch(
      /does not stock 1 mapped id\(s\): printrove_999/,
    );
    await as('PATCH', `/admin/variants/${skus[0]}`, {
      podVariantId: `sbx_${skus[0]}`,
    });

    // What the worker does when a render lands.
    await db.variant.updateMany({
      where: { sku: { in: skus } },
      data: { sequenceUrl: '/frames/x', mockupUrl: '/frames/x/still.avif' },
    });
    await as('PATCH', `/admin/drops/${slug}`, { accentColor: '#FF6B1A' });
    expect((await detail()).problemList).toEqual([]);
  });

  it('opens only one drop at a time, and schedules into the future only', async () => {
    const now = await as('POST', `/admin/drops/${slug}/publish`, {
      mode: 'now',
    });
    expect(now.statusCode).toBe(409);
    // Whichever is live — another suite may have its own test drop open.
    expect(now.json().message).toMatch(
      /^Drop \d{3} is live\. Close it first\.$/,
    );

    expect(
      (
        await as('POST', `/admin/drops/${slug}/publish`, { mode: 'schedule' })
      ).json().message,
    ).toMatch(/future/);
    await as('PATCH', `/admin/drops/${slug}`, {
      opensAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(
      (await as('POST', `/admin/drops/${slug}/publish`, { mode: 'schedule' }))
        .statusCode,
    ).toBe(204);
    expect((await detail()).status).toBe('SCHEDULED');
  });

  it('extends and closes a live drop, and never reopens it', async () => {
    // Live, but opened long ago, so it never becomes the storefront's live drop.
    const closesAt = new Date(Date.now() + 3_600_000);
    await db.drop.update({
      where: { slug },
      data: { status: 'LIVE', opensAt: new Date('2020-01-01'), closesAt },
    });
    expect(
      (await as('POST', `/admin/drops/${slug}/extend`, { hours: 24 }))
        .statusCode,
    ).toBe(204);
    expect(new Date((await detail()).closesAt as string).getTime()).toBe(
      closesAt.getTime() + 24 * 3_600_000,
    );
    expect(
      (await as('POST', `/admin/drops/${slug}/extend`, { hours: 500 }))
        .statusCode,
    ).toBe(400);
    expect(
      (await as('PATCH', `/admin/drops/${slug}`, { accentColor: '#D7FF3E' }))
        .statusCode,
    ).toBe(409);
    expect((await as('POST', `/admin/drops/${slug}/close`)).statusCode).toBe(
      204,
    );
    expect((await detail()).status).toBe('ARCHIVED');
    expect(
      (await as('POST', `/admin/drops/${slug}/publish`, { mode: 'now' }))
        .statusCode,
    ).toBe(409);
  });

  it('needs an operator for every drop route', async () => {
    expect(
      (await app.inject({ method: 'GET', url: '/admin/drops' })).statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ method: 'POST', url: `/admin/drops/${slug}/close` }))
        .statusCode,
    ).toBe(401);
  });
});
