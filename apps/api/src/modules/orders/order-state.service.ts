import { Injectable } from '@nestjs/common';
import type { Prisma } from '@nowcore/db';
import { markPaid } from '@nowcore/orders';
import type { PaymentMethod } from '@nowcore/shared';
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

  async markPaid(
    order: { id: string; cartId: string | null },
    source: string,
    payload: Prisma.InputJsonValue,
    method: PaymentMethod | null,
  ): Promise<boolean> {
    const moved = await markPaid(this.db, order, source, payload, method);
    if (moved) {
      await this.queue.submit(order.id);
      await this.queue.tell(order.id, 'confirmed');
    }
    return moved;
  }
}
