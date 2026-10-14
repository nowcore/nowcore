import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  QUEUE,
  type DropOpenJob,
  type NotifyJob,
  type PodSubmitJob,
} from '@nowcore/shared';
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
  private readonly notify: Queue<NotifyJob | DropOpenJob>;

  constructor(@Inject(ENV) env: Env) {
    this.pod = new Queue(QUEUE.pod, {
      connection: connection(env.REDIS_URL),
      prefix: env.QUEUE_PREFIX,
    });
    this.notify = new Queue(QUEUE.notify, {
      connection: connection(env.REDIS_URL),
      prefix: env.QUEUE_PREFIX,
    });
  }

  /** `attempt` distinguishes an operator retry from the first submission (see AdminOrdersService.retry). */
  async submit(orderId: string, attempt = 'first'): Promise<void> {
    await this.pod.add(
      'submit',
      { orderId },
      {
        jobId:
          attempt === 'first'
            ? `submit-${orderId}`
            : `submit-${orderId}-${attempt}`,
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

  /** One alert run per drop — the job id makes a second "open" a no-op. */
  async dropOpened(dropId: string): Promise<void> {
    await this.notify.add(
      'drop-open',
      { dropId },
      {
        jobId: `drop-open-${dropId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.pod.close(), this.notify.close()]);
  }
}
