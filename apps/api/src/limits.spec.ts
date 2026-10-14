import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from './create-app.js';
import { readEnv } from './env.js';
import { LIMITS } from './limits.js';
import { PrismaService } from './prisma.service.js';

/** Body and rate limits (docs/05 §6). Its own Redis namespace, so counters start at zero. */
describe('limits', () => {
  const env = readEnv({
    RECONCILE: 'off',
    DROP_CLOCK: 'off',
    QUEUE_PREFIX: `test-rl-${Math.random().toString(36).slice(2, 8)}`,
  });
  let app: NestFastifyApplication;
  const tag = `rl-${Date.now()}`;

  beforeAll(async () => {
    app = await createApp(env);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => {
    await app
      .get(PrismaService)
      .waitlistSubscription.deleteMany({ where: { email: { contains: tag } } });
    await app.close();
  });

  const join = (i: number, remoteAddress = '203.0.113.7') =>
    app.inject({
      method: 'POST',
      url: '/waitlist',
      remoteAddress,
      payload: { email: `${i}-${tag}@nowcore.test` },
    });

  it('limits a route per IP, says when to come back, and leaves other IPs and routes alone', async () => {
    for (let i = 0; i < 5; i++) expect((await join(i)).statusCode).toBe(200);
    const sixth = await join(5);
    expect(sixth.statusCode).toBe(429);
    expect(sixth.json().message).toMatch(
      /Too many requests\. Try again in \d+ s\./,
    );
    expect(Number(sixth.headers['retry-after'])).toBeGreaterThan(0);

    expect((await join(6, '203.0.113.8')).statusCode).toBe(200);
    const cart = await app.inject({
      method: 'POST',
      url: '/carts',
      remoteAddress: '203.0.113.7',
    });
    expect(cart.statusCode).toBe(201);
  });

  it('keys on the buyer IP the storefront forwards, and only with the shared secret', async () => {
    const viaWeb = (ip: string, secret: string) =>
      app.inject({
        method: 'POST',
        url: '/waitlist/unsubscribe',
        remoteAddress: '10.0.0.5', // the web server: one address for every buyer
        headers: { 'x-client-ip': ip, 'x-bff-secret': secret },
        payload: { email: `x-${tag}@nowcore.test`, token: '0'.repeat(32) },
      });
    for (let i = 0; i < 5; i++)
      expect((await viaWeb('198.51.100.1', env.BFF_SECRET)).statusCode).toBe(
        403,
      );
    expect((await viaWeb('198.51.100.1', env.BFF_SECRET)).statusCode).toBe(429);
    // Another buyer behind the same web server is not limited by the first.
    expect((await viaWeb('198.51.100.2', env.BFF_SECRET)).statusCode).toBe(403);
    // A forged header without the secret counts against the socket address instead.
    for (let i = 0; i < 5; i++)
      await viaWeb(`192.0.2.${i}`, 'wrong-secret-wrong-secret');
    expect(
      (await viaWeb('192.0.2.99', 'wrong-secret-wrong-secret')).statusCode,
    ).toBe(429);
  });

  it('refuses a large body on an ordinary route, and lets artwork through to its own checks', async () => {
    const big = { email: `${'a'.repeat(100_000)}@nowcore.test` };
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/waitlist',
          remoteAddress: '203.0.113.9',
          payload: big,
        })
      ).statusCode,
    ).toBe(413);
    // 1 MB to the artwork route reaches the operator check (401), not the body limit (413).
    const art = await app.inject({
      method: 'POST',
      url: '/admin/drops/x/artwork',
      payload: { colourway: 'blk', png: 'A'.repeat(1_000_000) },
    });
    expect(art.statusCode).toBe(401);
  });

  it('will not start with a limit for a route that does not exist', async () => {
    LIMITS['POST /no-such-route'] = { perMinute: 1 };
    try {
      const other = await createApp(
        readEnv({
          RECONCILE: 'off',
          DROP_CLOCK: 'off',
          RATE_LIMIT: 'off',
          QUEUE_PREFIX: 'test-api',
        }),
      );
      await expect(
        other.init().then(() => other.getHttpAdapter().getInstance().ready()),
      ).rejects.toThrow(/POST \/no-such-route/);
      await other.close().catch(() => undefined);
    } finally {
      delete LIMITS['POST /no-such-route'];
    }
  });
});
