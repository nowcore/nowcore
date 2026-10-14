import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { listToken } from '@nowcore/orders';
import { createApp } from '../../create-app.js';
import { readEnv } from '../../env.js';
import { PrismaService } from '../../prisma.service.js';

describe('waitlist', () => {
  const env = readEnv({
    RECONCILE: 'off',
    QUEUE_PREFIX: 'test-api',
    DROP_CLOCK: 'off',
    RATE_LIMIT: 'off',
  });
  let app: NestFastifyApplication;
  let db: PrismaService;
  const email = `wl-${Date.now()}@nowcore.test`;

  beforeAll(async () => {
    app = await createApp(env);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get(PrismaService);
  });
  afterAll(async () => {
    await db.waitlistSubscription.deleteMany({ where: { email } });
    await app.close();
  });

  const join = (e: string) =>
    app.inject({ method: 'POST', url: '/waitlist', payload: { email: e } });
  const leave = (e: string, token: string) =>
    app.inject({
      method: 'POST',
      url: '/waitlist/unsubscribe',
      payload: { email: e, token },
    });

  it('joins once, however many times, and answers the same either way', async () => {
    const first = await join(email);
    const again = await join(email.toUpperCase());
    expect(first.json()).toEqual({ ok: true });
    expect(again.json()).toEqual(first.json());
    expect(await db.waitlistSubscription.count({ where: { email } })).toBe(1);
    expect((await join('not-an-email')).statusCode).toBe(400);
  });

  it('unsubscribes only with the signed token, and re-joining brings them back', async () => {
    expect((await leave(email, '0'.repeat(32))).statusCode).toBe(403);
    expect(
      (await db.waitlistSubscription.findUniqueOrThrow({ where: { email } }))
        .unsubscribedAt,
    ).toBeNull();
    expect(
      (await leave(email, listToken(env.ORDER_TOKEN_SECRET, email))).statusCode,
    ).toBe(200);
    expect(
      (await db.waitlistSubscription.findUniqueOrThrow({ where: { email } }))
        .unsubscribedAt,
    ).not.toBeNull();
    await join(email);
    expect(
      (await db.waitlistSubscription.findUniqueOrThrow({ where: { email } }))
        .unsubscribedAt,
    ).toBeNull();
  });
});
