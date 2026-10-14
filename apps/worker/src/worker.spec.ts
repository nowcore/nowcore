import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { QueueEvents, type Queue } from 'bullmq';
import { readEnv, redisConnection } from './env.js';
import { QUEUES } from './queues.js';
import { WorkerModule } from './worker.module.js';

/**
 * Against a real Redis (pnpm infra:up), on purpose. The failure this exists
 * to catch — a processor registered with no worker consuming it — is
 * invisible to a unit test with a mocked queue: the job is accepted and
 * simply never runs.
 */
describe('worker', () => {
  it('picks up a job from Redis and completes it', async () => {
    const env = readEnv({
      QUEUE_PREFIX: `test-${Math.random().toString(36).slice(2, 10)}`,
    });
    const mod = await Test.createTestingModule({
      imports: [WorkerModule.with(env)],
    }).compile();
    const app = await mod.init();
    const queue = app.get<Queue>(getQueueToken(QUEUES.system));
    const events = new QueueEvents(QUEUES.system, {
      connection: redisConnection(env.REDIS_URL),
      prefix: env.QUEUE_PREFIX,
    });
    await events.waitUntilReady();

    const job = await queue.add(
      'ping',
      { at: 'now' },
      { removeOnComplete: true },
    );
    const result = await job.waitUntilFinished(events, 4_000);

    expect(result).toEqual({ pong: 'now' });
    await events.close();
    await app.close();
  });
});
