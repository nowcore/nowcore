import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUE, type NotifyJob, type PodSubmitJob } from '@nowcore/shared';
import { ENV, type Env } from '../../env.js';

function connection(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
  };
}

/**
 * The API's side of the fulfilment queue. Job ids are derived from the order
 * id, and BullMQ refuses a second job with the same id — so the checkout
 * verify, the webhook, and the reconciliation sweep can all "enqueue" the same
 * paid order and the printer still gets it once.
 */
@Injectable()
export class FulfilmentQueue implements OnModuleDestroy {
  private readonly pod: Queue<PodSubmitJob>;
  private readonly notify: Queue<NotifyJob>;

  constructor(@Inject(ENV) env: Env) {
    this.pod = new Queue(QUEUE.pod, { connection: connection(env.REDIS_URL) });
    this.notify = new Queue(QUEUE.notify, {
      connection: connection(env.REDIS_URL),
    });
  }

  async submit(orderId: string): Promise<void> {
    await this.pod.add(
      'submit',
      { orderId },
      {
        jobId: `submit-${orderId}`,
        // ~17 h of retries with exponential backoff before the order is marked
        // FULFILMENT_FAILED and an operator is told (docs/04 §6).
        attempts: 10,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: 1000,
        removeOnFail: false,
      },
    );
  }

  async tell(orderId: string, kind: NotifyJob['kind']): Promise<void> {
    await this.notify.add(
      kind,
      { orderId, kind },
      {
        jobId: `${kind}-${orderId}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.pod.close(), this.notify.close()]);
  }
}
