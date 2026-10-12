import type { RawBodyRequest } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { createHmac } from 'node:crypto';
import { createApp } from './create-app.js';
import { readEnv } from './env.js';

describe('api', () => {
  it('refuses to start when the database is unreachable', async () => {
    // Fail while the deploy is watching, not on a buyer's first request.
    const app = await createApp(
      readEnv({ DATABASE_URL: 'postgresql://nobody:wrong@localhost:1/none' }),
    );
    await expect(app.init()).rejects.toThrow(/./);
    // Not closed: Fastify's close path reads the address of a server that
    // never listened and throws synchronously. Nothing was opened to leak.
  });

  it('is ready when the database answers', async () => {
    const app = await createApp(readEnv({}));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const live = await app.inject({ method: 'GET', url: '/healthz' });
    const ready = await app.inject({ method: 'GET', url: '/readyz' });
    expect(live.json()).toEqual({ status: 'ok' });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual({ status: 'ok', database: 'ok' });
    await app.close();
  });

  it('keeps the exact request bytes, so a webhook HMAC can match', async () => {
    // A probe route on the real app: what a webhook handler will see.
    const app = await createApp(readEnv({}));
    app
      .getHttpAdapter()
      .post(
        '/probe',
        (
          req: RawBodyRequest<FastifyRequest>,
          reply: { send: (b: unknown) => void },
        ) =>
          reply.send({
            hmac: createHmac('sha256', 'k')
              .update(req.rawBody ?? '')
              .digest('hex'),
          }),
      );
    await app.init();
    // Spacing and key order a JSON round-trip would destroy.
    const body = '{"b":1,  "a":"x"}';
    const res = await app.inject({
      method: 'POST',
      url: '/probe',
      headers: { 'content-type': 'application/json' },
      payload: body,
    });
    expect(res.json()).toEqual({
      hmac: createHmac('sha256', 'k').update(body).digest('hex'),
    });
    await app.close();
  });
});
