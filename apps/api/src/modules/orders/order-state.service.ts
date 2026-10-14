import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@nowcore/db';
import { claimed, HOLD_MS, markPaid } from '@nowcore/orders';
import { parseSku, type PaymentMethod } from '@nowcore/shared';
import { PrismaService } from '../../prisma.service.js';
import { FulfilmentQueue } from '../fulfilment/fulfilment.queue.js';

/**
 * The API's door into the shared order transitions (libs/orders). Paying an
 * order hands it to the printer queue and the confirmation email — and only
 * the caller that actually moved it does, so a racing webhook and verify
 * enqueue once (and the queue's job ids make even that redundant).
 */
@Injectable()
export class OrderStateService {
  constructor(
    private readonly db: PrismaService,
    private readonly queue: FulfilmentQueue,
  ) {}

  private readonly log = new Logger('orders');

  /**
   * A payment can land after its hold lapsed (ADR-008) — the buyer took over
   * fifteen minutes — and by then the edition may have filled. The money is
   * real and the garment is printed on demand, so the order is honoured; the
   * event says it went over, and the log says so loudly.
   */
  private async overEdition(orderId: string, now: Date): Promise<boolean> {
    const o = await this.db.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!o || o.createdAt.getTime() > now.getTime() - HOLD_MS) return false;
    // Items are snapshots with no link to the catalogue; the drop is in the SKU.
    const wanted = new Map<number, number>();
    for (const i of o.items) {
      const n = parseSku(i.skuSnap).drop;
      wanted.set(n, (wanted.get(n) ?? 0) + i.quantity);
    }
    const drops = await this.db.drop.findMany({
      where: { number: { in: [...wanted.keys()] }, editionSize: { not: null } },
    });
    for (const d of drops)
      if (
        (await claimed(this.db, d.number, now, o.id)) +
          (wanted.get(d.number) ?? 0) >
        (d.editionSize ?? Infinity)
      )
        return true;
    return false;
  }

  async markPaid(
    order: { id: string; cartId: string | null },
    source: string,
    payload: Prisma.InputJsonValue,
    method: PaymentMethod | null,
  ): Promise<boolean> {
    const over = await this.overEdition(order.id, new Date());
    const moved = await markPaid(
      this.db,
      order,
      source,
      over && typeof payload === 'object' && payload && !Array.isArray(payload)
        ? { ...payload, overEdition: true }
        : payload,
      method,
    );
    if (moved && over)
      this.log.warn(
        `order ${order.id} paid after its hold lapsed; the edition is now over its cap`,
      );
    if (moved) {
      await this.queue.submit(order.id);
      await this.queue.tell(order.id, 'confirmed');
    }
    return moved;
  }
}
