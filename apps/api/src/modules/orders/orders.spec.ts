import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { CartView, OrderView, PlacedOrder } from '@nowcore/shared';
import { createApp } from '../../create-app.js';
import { readEnv } from '../../env.js';
import { PrismaService } from '../../prisma.service.js';
import { FakeProvider } from '../payments/fake.provider.js';
import { PAYMENT_PROVIDER } from '../payments/payment-provider.js';
import { ReconcileService } from './reconcile.service.js';

/**
 * Against the real database with the fake provider. Each run makes its own
 * drop (number 9xx, opened in 2020 so it never becomes "the live drop") and
 * removes it afterwards, so the seed is never touched.
 */
describe('orders', () => {
  let app: NestFastifyApplication;
  let db: PrismaService;
  let fake: FakeProvider;
  const number = 900 + Math.floor(Math.random() * 99);
  const tag = `NC-${number}`;
  let dropId = '';

  const address = {
    name: 'Ananya R',
    line1: '12 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
  };

  beforeAll(async () => {
    app = await createApp(
      readEnv({ RECONCILE: 'off', QUEUE_PREFIX: 'test-api' }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get(PrismaService);
    fake = app.get(PAYMENT_PROVIDER);
    const drop = await db.drop.create({
      data: {
        number,
        slug: `test-drop-${number}`,
        title: 'Test Drop',
        accentColor: '#D7FF3E',
        status: 'LIVE',
        opensAt: new Date('2020-01-01'),
        editionSize: 100,
        chapters: [],
        products: {
          create: {
            slug: `test-tee-${number}`,
            title: 'Test Tee',
            description: 'for tests',
            basePaise: 79900,
            variants: {
              create: ['M', 'L', 'XL'].map((size) => ({
                size,
                colorName: 'Void black',
                colorHex: '#15171B',
                sku: `${tag}-TEE-BLK-${size}`,
                pricePaise: 79900,
              })),
            },
          },
        },
      },
    });
    dropId = drop.id;
  });

  afterAll(async () => {
    const orders = await db.order.findMany({
      where: { items: { some: { skuSnap: { startsWith: tag } } } },
    });
    const ids = orders.map((o) => o.id);
    await db.orderEvent.deleteMany({ where: { orderId: { in: ids } } });
    await db.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await db.order.deleteMany({ where: { id: { in: ids } } });
    const variants = await db.variant.findMany({
      where: { sku: { startsWith: tag } },
    });
    await db.cartItem.deleteMany({
      where: { variantId: { in: variants.map((v) => v.id) } },
    });
    await db.variant.deleteMany({ where: { sku: { startsWith: tag } } });
    await db.product.deleteMany({ where: { dropId } });
    await db.drop.delete({ where: { id: dropId } });
    await app.close();
  });

  async function cartWith(...items: [string, number][]): Promise<string> {
    const cart = CartView.parse(
      (await app.inject({ method: 'POST', url: '/carts' })).json(),
    );
    for (const [size, quantity] of items) {
      await app.inject({
        method: 'PUT',
        url: `/carts/${cart.id}/items`,
        payload: { sku: `${tag}-TEE-BLK-${size}`, quantity },
      });
    }
    return cart.id;
  }
  const place = (
    cartId: string,
    pay: 'PREPAID' | 'COD' = 'PREPAID',
    phone = '9845012345',
  ) =>
    app.inject({
      method: 'POST',
      url: '/orders',
      payload: { cartId, email: 'a@nowcore.test', phone, address, pay },
    });
  const orderOf = (reference: string) =>
    db.order.findUniqueOrThrow({
      where: { reference },
      include: { events: true, items: true },
    });

  it('places a prepaid order: priced server-side, snapshotted, pending payment', async () => {
    const cartId = await cartWith(['L', 1]);
    const res = await place(cartId);
    expect(res.statusCode).toBe(201);
    const placed = PlacedOrder.parse(res.json());
    expect(placed.reference).toMatch(/^NC-\d{5,}$/);
    expect(placed.status).toBe('PENDING');
    expect(placed.payment).toMatchObject({
      provider: 'fake',
      amountPaise: 87900,
      keyId: null,
    });

    const order = await orderOf(placed.reference);
    expect(order).toMatchObject({
      subtotalPaise: 79900,
      shippingPaise: 8000,
      totalPaise: 87900,
      taxPaise: 3805,
    });
    expect(order.items[0]).toMatchObject({
      skuSnap: `${tag}-TEE-BLK-L`,
      titleSnap: 'Test Tee',
      sizeSnap: 'L',
      pricePaise: 79900,
    });
    // The cart survives until payment lands.
    expect(await db.cartItem.count({ where: { cartId } })).toBe(1);
  });

  it('marks paid on a valid signature, empties the cart, and is idempotent', async () => {
    const cartId = await cartWith(['M', 1]);
    const placed = PlacedOrder.parse((await place(cartId)).json());
    const providerOrderId = placed.payment?.providerOrderId as string;
    const paid = fake.pay(providerOrderId);
    const verify = () =>
      app.inject({
        method: 'POST',
        url: `/orders/${placed.reference}/verify`,
        payload: { providerOrderId, ...paid },
      });

    expect((await verify()).json()).toEqual({ status: 'PAID' });
    expect((await verify()).json()).toEqual({ status: 'PAID' });
    const order = await orderOf(placed.reference);
    expect(order.events.filter((e) => e.to === 'PAID')).toHaveLength(1);
    expect(await db.cartItem.count({ where: { cartId } })).toBe(0);
  });

  it('refuses a forged checkout signature', async () => {
    const placed = PlacedOrder.parse(
      (await place(await cartWith(['M', 1]))).json(),
    );
    const res = await app.inject({
      method: 'POST',
      url: `/orders/${placed.reference}/verify`,
      payload: {
        providerOrderId: placed.payment?.providerOrderId,
        paymentId: 'pay_x',
        signature: 'f'.repeat(64),
      },
    });
    expect(res.statusCode).toBe(400);
    expect((await orderOf(placed.reference)).status).toBe('PENDING');
  });

  it('applies a signed webhook once, however many times it is delivered', async () => {
    const placed = PlacedOrder.parse(
      (await place(await cartWith(['M', 1]))).json(),
    );
    const hook = fake.webhook(
      'paid',
      placed.payment?.providerOrderId as string,
      `fake_pay_${randomUUID()}`,
    );
    const send = (signature: string) =>
      app.inject({
        method: 'POST',
        url: '/webhooks/fake',
        headers: {
          'content-type': 'application/json',
          'x-fake-signature': signature,
        },
        payload: hook.body,
      });

    expect((await send('0'.repeat(64))).statusCode).toBe(401);
    expect((await send(hook.signature)).json()).toEqual({ ok: true });
    expect((await send(hook.signature)).json()).toEqual({
      ok: true,
      duplicate: true,
    });
    const order = await orderOf(placed.reference);
    expect(order.status).toBe('PAID');
    expect(order.method).toBe('UPI');
    expect(order.events.filter((e) => e.to === 'PAID')).toHaveLength(1);
  });

  it('lets exactly one of a racing verify and webhook move the order', async () => {
    const placed = PlacedOrder.parse(
      (await place(await cartWith(['M', 1]))).json(),
    );
    const providerOrderId = placed.payment?.providerOrderId as string;
    const paid = fake.pay(providerOrderId);
    const hook = fake.webhook('paid', providerOrderId, paid.paymentId);
    await Promise.all([
      app.inject({
        method: 'POST',
        url: `/orders/${placed.reference}/verify`,
        payload: { providerOrderId, ...paid },
      }),
      app.inject({
        method: 'POST',
        url: '/webhooks/fake',
        headers: {
          'content-type': 'application/json',
          'x-fake-signature': hook.signature,
        },
        payload: hook.body,
      }),
    ]);
    const order = await orderOf(placed.reference);
    expect(order.status).toBe('PAID');
    expect(order.events.filter((e) => e.to === 'PAID')).toHaveLength(1);
  });

  it('re-checks stock and price at the moment of ordering, not when carted', async () => {
    const cartId = await cartWith(['XL', 1]);
    await db.variant.update({
      where: { sku: `${tag}-TEE-BLK-XL` },
      data: { pricePaise: 84900 },
    });
    const placed = PlacedOrder.parse((await place(cartId)).json());
    expect((await orderOf(placed.reference)).items[0]?.pricePaise).toBe(84900);

    const cart2 = await cartWith(['XL', 1]);
    await db.variant.update({
      where: { sku: `${tag}-TEE-BLK-XL` },
      data: { soldOut: true },
    });
    const res = await place(cart2);
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toMatch(/sold out/);
    await db.variant.update({
      where: { sku: `${tag}-TEE-BLK-XL` },
      data: { soldOut: false, pricePaise: 79900 },
    });
  });

  it('refuses COD until a prepaid order has been delivered to that phone', async () => {
    const phone = '9000000001';
    const res = await place(await cartWith(['M', 1]), 'COD', phone);
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toMatch(/first prepaid order/);
  });

  it('shows an order only with its signed token', async () => {
    const placed = PlacedOrder.parse(
      (await place(await cartWith(['M', 1]))).json(),
    );
    expect(
      (await app.inject({ method: 'GET', url: `/orders/${placed.reference}` }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/orders/${placed.reference}?t=${'0'.repeat(32)}`,
        })
      ).statusCode,
    ).toBe(403);
    const ok = await app.inject({
      method: 'GET',
      url: `/orders/${placed.reference}?t=${placed.token}`,
    });
    expect(OrderView.parse(ok.json()).lines).toHaveLength(1);
  });

  it('reconciles an order whose webhook never came', async () => {
    const placed = PlacedOrder.parse(
      (await place(await cartWith(['M', 1]))).json(),
    );
    fake.pay(placed.payment?.providerOrderId as string); // paid at the provider; no webhook, no verify
    await db.order.update({
      where: { reference: placed.reference },
      data: { createdAt: new Date(Date.now() - 5 * 60_000) },
    });
    await app.get(ReconcileService).run();
    expect((await orderOf(placed.reference)).status).toBe('PAID');
  });

  it('refuses an order that would exceed the edition', async () => {
    // Shrink the edition to what earlier tests have claimed plus 2, then ask for 3.
    const claimed = await db.orderItem.aggregate({
      _sum: { quantity: true },
      where: {
        skuSnap: { startsWith: tag },
        // Every claimed status, not just PAID: a running worker moves paid
        // orders on to FULFILMENT_QUEUED and PRINTING while this suite runs.
        order: {
          status: {
            in: [
              'PAID',
              'FULFILMENT_QUEUED',
              'FULFILMENT_FAILED',
              'PRINTING',
              'SHIPPED',
              'DELIVERED',
            ],
          },
        },
      },
    });
    await db.drop.update({
      where: { id: dropId },
      data: { editionSize: (claimed._sum.quantity ?? 0) + 2 },
    });
    const res = await place(await cartWith(['M', 3]));
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toBe('Only 2 left in this edition.');
    expect((await place(await cartWith(['M', 2]))).statusCode).toBe(201);
  });
});
