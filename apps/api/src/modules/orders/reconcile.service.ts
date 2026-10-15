import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ENV, type Env } from '../../env.js';
import { PrismaService } from '../../prisma.service.js';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../payments/payment-provider.js';
import { FulfilmentQueue } from '../fulfilment/fulfilment.queue.js';
import { OrderStateService } from './order-state.service.js';

/**
 * Reconciliation (T-057). A webhook can be lost; a buyer who paid must not be
 * left PENDING because of it. Every 5 minutes, ask the provider about orders
 * pending for more than 2 minutes and less than a day.
 *
 * In the API for now because the worker has no database yet; it moves to a
 * worker job with the fulfilment queue. Running on several API instances is
 * safe — markPaid is idempotent — merely wasteful.
 */
/** How long field-performance samples are kept (apps/web /legal/privacy). */
export const RUM_DAYS = 90;

@Injectable()
export class ReconcileService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('reconcile');
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly db: PrismaService,
    private readonly state: OrderStateService,
    private readonly queue: FulfilmentQueue,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    if (this.env.RECONCILE === 'off') return;
    this.timer = setInterval(
      () => void this.run().catch((e: unknown) => this.log.error(e)),
      5 * 60_000,
    );
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async run(now = new Date()): Promise<number> {
    const pending = await this.db.order.findMany({
      where: {
        status: 'PENDING',
        razorpayOrderId: { not: null },
        createdAt: {
          lt: new Date(now.getTime() - 2 * 60_000),
          gt: new Date(now.getTime() - 24 * 3_600_000),
        },
      },
      take: 100,
    });
    let fixed = 0;
    for (const order of pending) {
      if (
        (await this.payments.status(order.razorpayOrderId as string)) !== 'paid'
      )
        continue;
      if (
        await this.state.markPaid(
          order,
          `${this.payments.name}:reconcile`,
          {},
          null,
        )
      )
        fixed++;
    }
    if (fixed)
      this.log.warn(`marked ${fixed} order(s) paid that no webhook confirmed`);

    // Paid but never handed to the printer — the enqueue failed, or Redis was
    // down when payment landed. Re-enqueueing is safe: the job id is the order.
    const stranded = await this.db.order.findMany({
      where: {
        status: 'PAID',
        podOrderId: null,
        createdAt: { lt: new Date(now.getTime() - 10 * 60_000) },
      },
      take: 100,
    });
    for (const order of stranded) await this.queue.submit(order.id);
    if (stranded.length)
      this.log.warn(
        `re-enqueued ${stranded.length} paid order(s) for the printer`,
      );

    // Anonymous performance data is kept 90 days — the privacy policy says so.
    await this.db.rumSample.deleteMany({
      where: {
        createdAt: { lt: new Date(now.getTime() - RUM_DAYS * 86_400_000) },
      },
    });
    return fixed;
  }
}
