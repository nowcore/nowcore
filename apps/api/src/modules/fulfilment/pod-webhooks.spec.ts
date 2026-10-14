import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { SandboxPrinter } from '@nowcore/pod';
import { createApp } from '../../create-app.js';
import { readEnv } from '../../env.js';
import { PrismaService } from '../../prisma.service.js';

/** Printer webhooks (T-061), against the real database. */
describe('printer webhooks', () => {
  const env = readEnv({
    RECONCILE: 'off',
    QUEUE_PREFIX: 'test-api',
    DROP_CLOCK: 'off',
  });
  const printer = new SandboxPrinter(env.POD_SANDBOX_SECRET);
  let app: NestFastifyApplication;
  let db: PrismaService;
  const made: string[] = [];

  beforeAll(async () => {
    app = await createApp(env);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get(PrismaService);
  });
  afterAll(async () => {
    await db.orderEvent.deleteMany({ where: { orderId: { in: made } } });
    await db.order.deleteMany({ where: { id: { in: made } } });
    await app.close();
  });

  async function printing() {
    const ref = `TEST-POD-${Date.now()}-${made.length}`;
    const o = await db.order.create({
      data: {
        reference: ref,
        email: 'p@nowcore.test',
        phone: '+919845012345',
        status: 'PRINTING',
        podOrderId: `sbx_order_${ref}`,
        subtotalPaise: 0,
        shippingPaise: 0,
        taxPaise: 0,
        totalPaise: 0,
        shippingAddress: {},
      },
    });
    made.push(o.id);
    return o;
  }
  const send = (
    hook: { body: string; signature: string },
    signature = hook.signature,
  ) =>
    app.inject({
      method: 'POST',
      url: '/webhooks/pod/sandbox',
      headers: {
        'content-type': 'application/json',
        'x-sandbox-signature': signature,
      },
      payload: hook.body,
    });

  it('refuses an unsigned or wrongly signed webhook', async () => {
    const o = await printing();
    const hook = printer.webhook(o.podOrderId as string, 'SHIPPED');
    expect((await send(hook, 'f'.repeat(64))).statusCode).toBe(401);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: o.id } })).status,
    ).toBe('PRINTING');
  });

  it('ships once, with tracking, however many times the printer says so', async () => {
    const o = await printing();
    const hook = printer.webhook(o.podOrderId as string, 'SHIPPED');
    expect((await send(hook)).json()).toEqual({ ok: true });
    expect((await send(hook)).json()).toEqual({ ok: true, duplicate: true });
    const now = await db.order.findUniqueOrThrow({
      where: { id: o.id },
      include: { events: true },
    });
    expect(now.status).toBe('SHIPPED');
    expect(now.trackingUrl).toContain(o.podOrderId);
    expect(now.events.filter((e) => e.to === 'SHIPPED')).toHaveLength(1);
  });

  it('records a return to origin, and refuses to deliver what never shipped', async () => {
    const shipped = await printing();
    await send(printer.webhook(shipped.podOrderId as string, 'SHIPPED'));
    await send(printer.webhook(shipped.podOrderId as string, 'RTO'));
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: shipped.id } })).status,
    ).toBe('RTO');

    const notShipped = await printing();
    expect(
      (
        await send(
          printer.webhook(notShipped.podOrderId as string, 'DELIVERED'),
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: notShipped.id } }))
        .status,
    ).toBe('PRINTING');
  });
});
