import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { transition } from '@nowcore/orders';
import { PodRejected, unmapped, type PodProvider } from '@nowcore/pod';
import { Address, PodSubmitJob, QUEUE } from '@nowcore/shared';
import { PrismaService } from '../prisma.service.js';
import { POD_PROVIDER } from '../tokens.js';

/**
 * `pod.submit` (T-060): a paid order goes to the printer.
 *
 *   PAID → FULFILMENT_QUEUED      this job has it
 *   unmapped variant → FAILED     permanent; an operator must map it. No retry.
 *   printer refuses → FAILED      permanent, same
 *   printer down → throw          BullMQ retries with backoff (~17 h)
 *   accepted → PRINTING           the printer's id is stored
 *   retries exhausted → FAILED    and an operator is told
 *
 * Safe to run twice: every transition is guarded, and the printer must treat
 * our reference as an idempotency key (libs/pod), so a crash after the printer
 * accepted but before we saved its id cannot print the garment twice.
 */
@Processor(QUEUE.pod, { concurrency: 4 })
export class PodSubmitProcessor extends WorkerHost {
  private readonly log = new Logger('pod.submit');

  constructor(
    private readonly db: PrismaService,
    @Inject(POD_PROVIDER) private readonly pod: PodProvider,
  ) {
    super();
  }

  async process(job: Job): Promise<{ result: string }> {
    const { orderId } = PodSubmitJob.parse(job.data);
    const source = `worker:${job.id}`;
    let order = await this.db.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return { result: 'no such order' };

    if (order.status === 'PAID') {
      await transition(
        this.db,
        order.id,
        'PAID',
        'FULFILMENT_QUEUED',
        source,
        {},
      );
      order = await this.db.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });
    }
    if (order.status !== 'FULFILMENT_QUEUED')
      return { result: `skipped: ${order.status}` };

    const variants = await this.db.variant.findMany({
      where: { id: { in: order.items.map((i) => i.variantId) } },
    });
    const podIds = new Map(variants.map((v) => [v.id, v.podVariantId]));
    const lines = order.items.map((i) => ({
      sku: i.skuSnap,
      podVariantId: podIds.get(i.variantId) ?? null,
      quantity: i.quantity,
    }));
    const missing = unmapped(lines);
    if (missing.length) {
      await this.fail(
        order.id,
        source,
        `unmapped variants: ${missing.join(', ')}`,
      );
      return { result: 'failed: unmapped' };
    }

    const ship = Address.parse(order.shippingAddress);
    let podOrderId: string;
    try {
      ({ podOrderId } = await this.pod.createOrder({
        reference: order.reference,
        cod: order.method === 'COD',
        collectPaise: order.method === 'COD' ? order.totalPaise : 0,
        ship: { ...ship, phone: order.phone },
        items: lines.map((l) => ({
          sku: l.sku,
          podVariantId: l.podVariantId as string,
          quantity: l.quantity,
        })),
      }));
    } catch (e) {
      if (e instanceof PodRejected) {
        await this.fail(order.id, source, `printer refused: ${e.message}`);
        return { result: 'failed: refused' };
      }
      throw e; // transient: BullMQ retries with backoff
    }

    await this.db.order.update({
      where: { id: order.id },
      data: { podOrderId },
    });
    await transition(
      this.db,
      order.id,
      'FULFILMENT_QUEUED',
      'PRINTING',
      `pod:${this.pod.name}`,
      { podOrderId },
    );
    this.log.log(`${order.reference} → ${podOrderId}`);
    return { result: 'printing' };
  }

  /** Retries exhausted on a transient error: give up loudly. */
  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error): Promise<void> {
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;
    const parsed = PodSubmitJob.safeParse(job.data);
    if (parsed.success)
      await this.fail(
        parsed.data.orderId,
        `worker:${job.id}`,
        `gave up: ${error.message}`,
      );
  }

  private async fail(
    orderId: string,
    source: string,
    reason: string,
  ): Promise<void> {
    await transition(
      this.db,
      orderId,
      'FULFILMENT_QUEUED',
      'FULFILMENT_FAILED',
      source,
      { reason },
    );
    // The operator alert. Sentry (T-095) and the admin order board (T-069) are
    // where a person will actually see it; until then the log is the alert.
    this.log.error(
      `OPERATOR: order ${orderId} cannot be fulfilled — ${reason}`,
    );
  }
}
