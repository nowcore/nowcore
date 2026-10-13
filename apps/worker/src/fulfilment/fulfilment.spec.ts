import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { QueueEvents, type Queue } from 'bullmq';
import { validOrderToken } from '@nowcore/orders';
import { QUEUE } from '@nowcore/shared';
import { readEnv, redisConnection } from '../env.js';
import { PrismaService } from '../prisma.service.js';
import { MAILER } from '../tokens.js';
import { WorkerModule } from '../worker.module.js';
import { ConsoleMailer } from './mailer.js';

/**
 * Against real Postgres and Redis. Each run makes its own drop (9xx, opened in
 * 2020) and orders, and deletes them afterwards.
 */
describe('fulfilment', () => {
  const env = readEnv({});
  const mailer = new ConsoleMailer();
  const number = 900 + Math.floor(Math.random() * 99);
  const tag = `NC-${number}`;
  let db: PrismaService;
  let pod: Queue;
  let notify: Queue;
  let events: QueueEvents;
  let notifyEvents: QueueEvents;
  let close: () => Promise<void>;
  let mapped = '';
  let unmappedVariant = '';
  let seq = 0;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [WorkerModule.with(env)],
    })
      .overrideProvider(MAILER)
      .useValue(mailer)
      .compile();
    const app = await mod.init();
    close = () => app.close();
    db = app.get(PrismaService);
    pod = app.get(getQueueToken(QUEUE.pod));
    notify = app.get(getQueueToken(QUEUE.notify));
    events = new QueueEvents(QUEUE.pod, {
      connection: redisConnection(env.REDIS_URL),
    });
    notifyEvents = new QueueEvents(QUEUE.notify, {
      connection: redisConnection(env.REDIS_URL),
    });
    await Promise.all([events.waitUntilReady(), notifyEvents.waitUntilReady()]);

    const drop = await db.drop.create({
      data: {
        number,
        slug: `fulfil-${number}`,
        title: 'Fulfil Test',
        accentColor: '#D7FF3E',
        status: 'LIVE',
        opensAt: new Date('2020-01-01'),
        chapters: [],
        products: {
          create: {
            slug: `fulfil-tee-${number}`,
            title: 'Fulfil Tee',
            description: 'test',
            basePaise: 79900,
            variants: {
              create: [
                {
                  size: 'L',
                  colorName: 'Void black',
                  colorHex: '#15171B',
                  sku: `${tag}-TEE-BLK-L`,
                  pricePaise: 79900,
                  podVariantId: `sbx_${tag}-L`,
                },
                {
                  size: 'XL',
                  colorName: 'Void black',
                  colorHex: '#15171B',
                  sku: `${tag}-TEE-BLK-XL`,
                  pricePaise: 79900,
                },
              ],
            },
          },
        },
      },
      include: { products: { include: { variants: true } } },
    });
    const vs = drop.products[0]?.variants ?? [];
    mapped = vs.find((v) => v.size === 'L')?.id ?? '';
    unmappedVariant = vs.find((v) => v.size === 'XL')?.id ?? '';
  });

  afterAll(async () => {
    const orders = await db.order.findMany({
      where: { reference: { startsWith: `TEST-${number}-` } },
    });
    const ids = orders.map((o) => o.id);
    await db.orderEvent.deleteMany({ where: { orderId: { in: ids } } });
    await db.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await db.order.deleteMany({ where: { id: { in: ids } } });
    await db.variant.deleteMany({ where: { sku: { startsWith: tag } } });
    await db.product.deleteMany({ where: { slug: `fulfil-tee-${number}` } });
    await db.drop.deleteMany({ where: { number } });
    await Promise.all([events.close(), notifyEvents.close()]);
    await close();
  });

  async function paidOrder(variantId: string, size: string) {
    return db.order.create({
      data: {
        reference: `TEST-${number}-${++seq}`,
        email: 'buyer@nowcore.test',
        phone: '+919845012345',
        status: 'PAID',
        subtotalPaise: 79900,
        shippingPaise: 8000,
        taxPaise: 3805,
        totalPaise: 87900,
        shippingAddress: {
          name: 'A B',
          line1: '12 MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
        items: {
          create: {
            variantId,
            titleSnap: 'Fulfil Tee',
            skuSnap: `${tag}-TEE-BLK-${size}`,
            sizeSnap: size,
            colorSnap: 'Void black',
            pricePaise: 79900,
            quantity: 1,
          },
        },
      },
    });
  }
  const run = async (orderId: string, id: string) => {
    const job = await pod.add(
      'submit',
      { orderId },
      { jobId: id, attempts: 1 },
    );
    return job.waitUntilFinished(events, 8000);
  };

  it('takes a paid order to the printer: PAID → FULFILMENT_QUEUED → PRINTING', async () => {
    const order = await paidOrder(mapped, 'L');
    expect(await run(order.id, `t-${order.id}`)).toEqual({
      result: 'printing',
    });
    const now = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { events: true },
    });
    expect(now.status).toBe('PRINTING');
    expect(now.podOrderId).toBe(`sbx_order_${order.reference}`);
    expect(now.events.map((e) => e.to)).toEqual([
      'FULFILMENT_QUEUED',
      'PRINTING',
    ]);
  });

  it('is safe to run twice: the second run changes nothing', async () => {
    const order = await paidOrder(mapped, 'L');
    await run(order.id, `a-${order.id}`);
    expect(await run(order.id, `b-${order.id}`)).toEqual({
      result: 'skipped: PRINTING',
    });
    const now = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { events: true },
    });
    expect(now.events.filter((e) => e.to === 'PRINTING')).toHaveLength(1);
  });

  it('fails an unmapped variant permanently, without retrying', async () => {
    const order = await paidOrder(unmappedVariant, 'XL');
    expect(await run(order.id, `u-${order.id}`)).toEqual({
      result: 'failed: unmapped',
    });
    const now = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { events: true },
    });
    expect(now.status).toBe('FULFILMENT_FAILED');
    expect(now.podOrderId).toBeNull();
    expect(JSON.stringify(now.events.at(-1)?.payload)).toContain(
      `${tag}-TEE-BLK-XL`,
    );
  });

  it('emails a confirmation whose link the API will accept', async () => {
    const order = await paidOrder(mapped, 'L');
    const job = await notify.add(
      'confirmed',
      { orderId: order.id, kind: 'confirmed' },
      { jobId: `n-${order.id}` },
    );
    await job.waitUntilFinished(notifyEvents, 8000);
    const mail = mailer.sent.find((m) => m.subject.includes(order.reference));
    expect(mail?.to).toBe('buyer@nowcore.test');
    const token = /[?&]t=([0-9a-f]+)/.exec(mail?.text ?? '')?.[1];
    expect(
      validOrderToken(env.ORDER_TOKEN_SECRET, order.reference, token),
    ).toBe(true);
  });
});
