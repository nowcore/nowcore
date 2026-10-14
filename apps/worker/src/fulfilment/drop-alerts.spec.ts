import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { QueueEvents, type Queue } from 'bullmq';
import { QUEUE } from '@nowcore/shared';
import { readEnv, redisConnection } from '../env.js';
import { PrismaService } from '../prisma.service.js';
import { MAILER } from '../tokens.js';
import { WorkerModule } from '../worker.module.js';
import { ConsoleMailer } from './mailer.js';

/** Drop-open alerts (T-083): one per subscriber per drop, ever. Real Postgres and Redis. */
describe('drop alerts', () => {
  const env = readEnv({
    QUEUE_PREFIX: `test-${Math.random().toString(36).slice(2, 10)}`,
    TRENDS: 'off',
  });
  const mailer = new ConsoleMailer();
  const number = 700 + Math.floor(Math.random() * 99);
  const tag = `alerts-${number}-${Date.now()}`;
  let db: PrismaService;
  let notify: Queue;
  let events: QueueEvents;
  let close: () => Promise<void>;
  let dropId = '';

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
    notify = app.get(getQueueToken(QUEUE.notify));
    events = new QueueEvents(QUEUE.notify, {
      connection: redisConnection(env.REDIS_URL),
      prefix: env.QUEUE_PREFIX,
    });
    await events.waitUntilReady();
    const drop = await db.drop.create({
      data: {
        number,
        slug: `alerts-${number}`,
        title: 'Alert Test',
        accentColor: '#D7FF3E',
        status: 'LIVE',
        opensAt: new Date('2020-01-01'),
        chapters: [],
      },
    });
    dropId = drop.id;
    await db.waitlistSubscription.createMany({
      data: [
        { email: `a-${tag}@nowcore.test` },
        { email: `b-${tag}@nowcore.test` },
        { email: `gone-${tag}@nowcore.test`, unsubscribedAt: new Date() },
      ],
    });
  });

  afterAll(async () => {
    await db.dropAlert.deleteMany({ where: { dropId } });
    await db.waitlistSubscription.deleteMany({
      where: { email: { contains: tag } },
    });
    await db.drop.delete({ where: { id: dropId } });
    await events.close();
    await close();
  });

  const run = async (id: string) =>
    (
      await notify.add('drop-open', { dropId }, { jobId: id })
    ).waitUntilFinished(events, 8000);
  const mine = () => mailer.sent.filter((m) => m.to.includes(tag));

  it('mails each active subscriber once, and skips the unsubscribed', async () => {
    const r = (await run(`open-1-${tag}`)) as { sent: number; skipped: number };
    expect(
      mine()
        .map((m) => m.to.split('-')[0])
        .sort(),
    ).toEqual(['a', 'b']);
    expect(r.sent).toBeGreaterThanOrEqual(2);
    expect(mine()[0]?.text).toMatch(/\/unsubscribe\?e=.+&t=[0-9a-f]{32}/);
  });

  it('a second run for the same drop mails nobody it already told', async () => {
    const before = mine().length;
    await run(`open-2-${tag}`);
    expect(mine().length).toBe(before);
    expect(
      await db.dropAlert.count({
        where: { dropId, subscription: { email: { contains: tag } } },
      }),
    ).toBe(2);
  });
});
