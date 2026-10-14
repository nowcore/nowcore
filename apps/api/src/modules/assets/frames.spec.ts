import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../create-app.js';
import { readEnv } from '../../env.js';

describe('frames', () => {
  let app: NestFastifyApplication;
  let dir = '';

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nc-frames-'));
    await mkdir(join(dir, 'drop/blk-abc'), { recursive: true });
    await writeFile(
      join(dir, 'drop/blk-abc/still.avif'),
      Buffer.from('not really avif'),
    );
    await writeFile(join(dir, 'secret.txt'), 'nope');
    app = await createApp(
      readEnv({
        RECONCILE: 'off',
        QUEUE_PREFIX: 'test-api',
        DROP_CLOCK: 'off',
        RATE_LIMIT: 'off',
        FRAMES_DIR: dir,
      }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(() => app.close());

  it('serves a frame written after the app started, cached forever', async () => {
    // The reason this route exists: Next served only frames present at build time.
    await mkdir(join(dir, 'late/bone-xyz'), { recursive: true });
    await writeFile(
      join(dir, 'late/bone-xyz/f00.avif'),
      Buffer.from('late frame'),
    );
    const res = await app.inject({
      method: 'GET',
      url: '/frames/late/bone-xyz/f00.avif',
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/avif');
    expect(res.headers['cache-control']).toContain('immutable');
    expect(res.body).toBe('late frame');
  });

  it('refuses traversal, unknown types and missing files', async () => {
    expect(
      (await app.inject({ method: 'GET', url: '/frames/../secret.txt' }))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/frames/%2e%2e/%2e%2e/etc/passwd.png',
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: 'GET', url: '/frames/secret.txt' }))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/frames/drop/blk-abc/nope.avif',
        })
      ).statusCode,
    ).toBe(404);
  });
});
