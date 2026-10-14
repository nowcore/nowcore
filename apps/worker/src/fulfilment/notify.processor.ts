import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import { listToken, orderToken } from '@nowcore/orders';
import { Prisma } from '@nowcore/db';
import { formatInr } from '@nowcore/shared/format';
import { DropOpenJob, NotifyJob, QUEUE, dropLabel } from '@nowcore/shared';
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

  async process(job: Job): Promise<unknown> {
    if (job.name === 'drop-open')
      return this.dropOpened(DropOpenJob.parse(job.data).dropId);
    const { orderId, kind } = NotifyJob.parse(job.data);
    const o = await this.db.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!o) return undefined;
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
    return undefined;
  }

  /**
   * A drop opened: one alert to every active subscriber (T-083).
   *
   * At most once, on purpose. The ledger row is claimed *before* sending, so
   * a crash or retry can make someone miss this alert but can never send them
   * two — the promise under the form is "one message per drop, nothing else,
   * ever". A subscriber who joins while the alerts are going out is included
   * if the loop reaches them, and never mailed twice either way.
   */
  private async dropOpened(
    dropId: string,
  ): Promise<{ sent: number; skipped: number }> {
    const drop = await this.db.drop.findUnique({
      where: { id: dropId },
      include: { products: { take: 1 } },
    });
    if (!drop || drop.status !== 'LIVE') return { sent: 0, skipped: 0 };
    const product = drop.products[0];
    let sent = 0;
    let skipped = 0;
    let cursor: string | undefined;
    for (;;) {
      const batch = await this.db.waitlistSubscription.findMany({
        where: { unsubscribedAt: null },
        orderBy: { id: 'asc' },
        take: 200,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (batch.length === 0) break;
      for (const sub of batch) {
        try {
          await this.db.dropAlert.create({
            data: { subscriptionId: sub.id, dropId },
          });
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          ) {
            skipped++;
            continue;
          }
          throw e;
        }
        const leave = `${this.env.WEB_URL}/unsubscribe?e=${encodeURIComponent(sub.email)}&t=${listToken(this.env.ORDER_TOKEN_SECRET, sub.email)}`;
        await this.mailer.send({
          to: sub.email,
          subject: `${dropLabel(drop.number)} is live — ${drop.title}`,
          text: `${drop.title} is live for 72 hours. Printed to order, never restocked.\n\n${this.env.WEB_URL}${product ? `/product/${product.slug}` : '/'}\n\nOne message per drop. Leave the list: ${leave}`,
        });
        sent++;
      }
      cursor = batch.at(-1)?.id;
    }
    return { sent, skipped };
  }
}
