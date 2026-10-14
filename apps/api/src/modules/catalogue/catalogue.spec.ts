import { DropView, ProductPage, DropSummary } from '@nowcore/shared';
import { z } from 'zod';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../create-app.js';
import { readEnv } from '../../env.js';

/** Against the seeded local database (pnpm db:seed): drop 014 live, 013 archived. */
describe('catalogue', () => {
  let app: NestFastifyApplication;
  beforeAll(async () => {
    app = await createApp(
      readEnv({ QUEUE_PREFIX: 'test-api', DROP_CLOCK: 'off' }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(() => app.close());

  const get = (url: string) => app.inject({ method: 'GET', url });

  it('serves the live drop in the shared contract', async () => {
    const res = await get('/drops/live');
    expect(res.statusCode).toBe(200);
    const drop = DropView.parse(res.json());
    expect(drop.number).toBe(14);
    expect(drop.status).toBe('LIVE');
    expect(drop.chapters).toHaveLength(7);
    expect(res.headers['cache-control']).toContain('s-maxage=30');
  });

  it('groups variants into colourways with sizes in garment order and frames', async () => {
    const { products } = DropView.parse((await get('/drops/live')).json());
    const tee = products[0];
    expect(tee?.colourways.map((c) => c.code)).toEqual([
      'blk',
      'ash',
      'bone',
      'moss',
    ]);
    expect(tee?.colourways[0]?.sizes.map((s) => s.size)).toEqual([
      'XS',
      'S',
      'M',
      'L',
      'XL',
      '2XL',
      '3XL',
    ]);
    expect(tee?.colourways[0]?.frames?.full).toHaveLength(72);
    expect(tee?.colourways[0]?.frames?.still).toBe(
      'http://localhost:4100/frames/mediocre-by-design/blk/still.avif',
    );
    expect(tee?.fromPaise).toBe(79900);
  });

  it('shows sold-out sizes rather than hiding them (FR-5)', async () => {
    const { products } = DropView.parse((await get('/drops/live')).json());
    const sizes = products[0]?.colourways[0]?.sizes ?? [];
    expect(sizes.find((s) => s.size === 'XS')?.soldOut).toBe(true);
    expect(sizes.find((s) => s.size === 'L')?.soldOut).toBe(false);
  });

  it('lists the archive and serves a product page', async () => {
    const archive = z
      .array(DropSummary)
      .parse((await get('/drops/archive')).json());
    expect(archive.map((d) => d.number)).toEqual([13]);
    // The hero colourway's still — the only one rendered for drop 013.
    expect(archive[0]?.still).toBe(
      'http://localhost:4100/frames/touch-grass-protocol/blk/still.avif',
    );
    const page = ProductPage.parse(
      (await get('/products/mediocre-by-design-tee')).json(),
    );
    expect(page.drop.number).toBe(14);
  });

  it('404s an unknown slug and refuses a malformed one', async () => {
    expect((await get('/products/nope')).statusCode).toBe(404);
    expect((await get('/drops/..%2Fetc')).statusCode).toBe(400);
  });
});
