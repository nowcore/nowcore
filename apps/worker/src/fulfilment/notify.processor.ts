import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import { orderToken } from '@nowcore/orders';
import { formatInr } from '@nowcore/shared/format';
import { NotifyJob, QUEUE } from '@nowcore/shared';
import type { Env } from '../env.js';
import { PrismaService } from '../prisma.service.js';
import { MAILER, WORKER_ENV } from '../tokens.js';
import type { Mailer } from './mailer.js';

/**
 * Buyer emails (T-062): confirmed, and shipped with tracking. Each job id is
 * the order plus the kind, so an email is queued once however many times the
 * transition is reported. Plain text on purpose: it renders everywhere.
 */
@Processor(QUEUE.notify, { concurrency: 4 })
export class NotifyProcessor extends WorkerHost {
  constructor(
    private readonly db: PrismaService,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(WORKER_ENV) private readonly env: Env,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { orderId, kind } = NotifyJob.parse(job.data);
    const o = await this.db.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!o) return;
    const link = `${this.env.WEB_URL}/order/${o.reference}?t=${orderToken(this.env.ORDER_TOKEN_SECRET, o.reference)}`;
    const lines = o.items
      .map(
        (i) =>
          `  ${i.titleSnap} — ${i.colorSnap}, ${i.sizeSnap} × ${i.quantity}`,
      )
      .join('\n');

    if (kind === 'confirmed') {
      await this.mailer.send({
        to: o.email,
        subject: `NOWCORE ${o.reference} — it is yours`,
        text: `Your order is confirmed and going to the press.\n\n${lines}\n\nTotal ${formatInr(o.totalPaise)}${o.method === 'COD' ? ' (cash on delivery)' : ''}\n\nTrack it: ${link}\n\nPrinted to order. Ships in 3–5 days.`,
      });
    } else {
      await this.mailer.send({
        to: o.email,
        subject: `NOWCORE ${o.reference} — shipped`,
        text: `It is on its way.\n\n${lines}\n\nCourier tracking: ${o.trackingUrl ?? 'available shortly'}\nYour order: ${link}`,
      });
    }
  }
}
