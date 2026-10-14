import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AdminOrderDetail, AdminOrderList, Session } from '@nowcore/shared';
import { createApp } from '../../create-app.js';
import { readEnv } from '../../env.js';
import { PrismaService } from '../../prisma.service.js';
import { AdminOrdersService } from './admin-orders.service.js';

/**
 * Against the seeded database — signs in as the operator `pnpm db:seed`
 * creates, which is what keeps the seed's password hashing and the API's
 * verification in step.
 */
describe('admin', () => {
  let app: NestFastifyApplication;
  let db: PrismaService;
  let token = '';
  const made: string[] = [];
  const tag = `ADM-${Date.now()}`;

  const login = (email: string, password: string) =>
    app.inject({
      method: 'POST',
      url: '/admin/session',
      payload: { email, password },
    });
  const as = (
    method: 'GET' | 'POST',
    url: string,
    payload?: object,
    t = token,
  ) =>
    app.inject({
      method,
      url,
      ...(payload ? { payload } : {}),
      headers: { authorization: `Bearer ${t}` },
    });

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
      (await login('admin@nowcore.local', 'nowcore-local-admin')).json(),
    ).token;
  });
  afterAll(async () => {
    await db.orderEvent.deleteMany({ where: { orderId: { in: made } } });
    await db.order.deleteMany({ where: { id: { in: made } } });
    await app.close();
  });

  async function order(
    status: 'PENDING' | 'PAID' | 'FULFILMENT_FAILED' | 'PRINTING',
    extra: object = {},
  ) {
    const o = await db.order.create({
      data: {
        reference: `${tag}-${made.length}`,
        email: 'buyer@nowcore.test',
        phone: '+919845012345',
        status,
        subtotalPaise: 79900,
        shippingPaise: 8000,
        taxPaise: 3805,
        totalPaise: 87900,
        shippingAddress: { city: 'Pune' },
        ...extra,
      },
    });
    made.push(o.id);
    return o;
  }

  it('signs in the seeded operator and refuses a wrong password with one message', async () => {
    expect(token).toHaveLength(43);
    const wrong = await login('admin@nowcore.local', 'nope');
    const nobody = await login('nobody@nowcore.local', 'nope');
    expect(wrong.statusCode).toBe(401);
    expect(nobody.json().message).toBe(wrong.json().message);
  });

  it('locks an email after five failures', async () => {
    const email = `lock-${Date.now()}@nowcore.local`;
    for (let i = 0; i < 5; i++)
      expect((await login(email, 'x')).statusCode).toBe(401);
    expect((await login(email, 'x')).statusCode).toBe(429);
  });

  it('refuses every admin route without a live session', async () => {
    expect(
      (await app.inject({ method: 'GET', url: '/admin/orders' })).statusCode,
    ).toBe(401);
    expect(
      (await as('GET', '/admin/orders', undefined, 'forged-token')).statusCode,
    ).toBe(401);
    // An expired session is as good as none.
    const s = Session.parse(
      (await login('admin@nowcore.local', 'nowcore-local-admin')).json(),
    );
    const { createHash } = await import('node:crypto');
    await db.operatorSession.update({
      where: { tokenHash: createHash('sha256').update(s.token).digest('hex') },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await as('GET', '/admin/me', undefined, s.token)).statusCode).toBe(
      401,
    );
    expect((await as('GET', '/admin/me')).json()).toEqual({
      email: 'admin@nowcore.local',
      name: 'Operator',
    });
  });

  it('lists orders, filters the ones needing attention, and searches', async () => {
    const failed = await order('FULFILMENT_FAILED');
    await order('PRINTING');
    const attention = AdminOrderList.parse(
      (await as('GET', '/admin/orders?status=attention')).json(),
    );
    expect(attention.orders.map((o) => o.reference)).toContain(
      failed.reference,
    );
    expect(
      attention.orders.every((o) => o.status === 'FULFILMENT_FAILED'),
    ).toBe(true);
    expect(attention.counts['attention']).toBeGreaterThanOrEqual(1);
    const found = AdminOrderList.parse(
      (await as('GET', `/admin/orders?q=${failed.reference}`)).json(),
    );
    expect(found.orders).toHaveLength(1);
  });

  it('offers only the actions the state machine allows', async () => {
    const pending = await order('PENDING');
    const printing = await order('PRINTING');
    const d1 = AdminOrderDetail.parse(
      (await as('GET', `/admin/orders/${pending.reference}`)).json(),
    );
    const d2 = AdminOrderDetail.parse(
      (await as('GET', `/admin/orders/${printing.reference}`)).json(),
    );
    expect(d1.actions).toEqual(['cancel']);
    expect(d2.actions).toEqual([]);
    expect(
      (await as('POST', `/admin/orders/${printing.reference}/cancel`))
        .statusCode,
    ).toBe(409);
  });

  it('retries a failed fulfilment back onto the printer queue', async () => {
    const failed = await order('FULFILMENT_FAILED');
    expect(
      (await as('POST', `/admin/orders/${failed.reference}/retry`)).statusCode,
    ).toBe(204);
    const d = AdminOrderDetail.parse(
      (await as('GET', `/admin/orders/${failed.reference}`)).json(),
    );
    expect(d.status).toBe('FULFILMENT_QUEUED');
    expect(d.events.at(-1)).toMatchObject({
      from: 'FULFILMENT_FAILED',
      to: 'FULFILMENT_QUEUED',
      source: 'operator:admin@nowcore.local',
    });
    expect(
      (await as('POST', `/admin/orders/${failed.reference}/retry`)).statusCode,
    ).toBe(409);
  });

  it('records a refund as recorded-only, never claiming the system moved money', async () => {
    const paid = await order('PAID');
    expect(
      (
        await as('POST', `/admin/orders/${paid.reference}/refund`, {
          note: 'size swap',
        })
      ).statusCode,
    ).toBe(204);
    const d = AdminOrderDetail.parse(
      (await as('GET', `/admin/orders/${paid.reference}`)).json(),
    );
    expect(d.status).toBe('REFUNDED');
    expect(d.events.at(-1)?.payload).toMatchObject({
      recordedOnly: true,
      note: 'size swap',
    });
  });

  it('reports the dashboard over claimed orders only', async () => {
    // On a day no other suite touches: dashboard totals are global, and suites
    // run in parallel against one database.
    const day = new Date('2020-02-02T06:30:00Z');
    const at = { createdAt: day };
    await order('PAID', { method: 'COD', ...at });
    await order('PRINTING', at);
    await order('PENDING', at);
    const d = await app
      .get(AdminOrdersService)
      .dashboard('today', new Date('2020-02-02T12:00:00Z'));
    expect(d.orders).toBe(2);
    expect(d.revenuePaise).toBe(2 * 87900);
    expect(d.aovPaise).toBe(87900);
    expect(d.codShare).toBe(0.5);
    expect(d.printSla).toBeNull(); // nothing paid more than 24 h before "now" with events to judge
  });
});
