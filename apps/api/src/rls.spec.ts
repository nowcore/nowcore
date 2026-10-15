import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from './create-app.js';
import { readEnv } from './env.js';
import { PrismaService } from './prisma.service.js';

/**
 * Supabase serves every `public` table to anyone holding the publishable key
 * unless row-level security is on. Found 15 Oct 2026: the hosted project
 * answered /rest/v1/orders to the public key. A new table is created with RLS
 * off, so every migration that adds one must enable it — this test fails
 * until it does (see migration *_row_level_security).
 */
describe('row-level security', () => {
  let app: NestFastifyApplication;
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
  });
  afterAll(() => app.close());

  it('is on for every table in public', async () => {
    const off = await app.get(PrismaService).$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity ORDER BY 1`;
    expect(off.map((t) => t.tablename)).toEqual([]);
  });
});
