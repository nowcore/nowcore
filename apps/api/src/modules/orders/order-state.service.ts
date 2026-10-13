import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@nowcore/db';
import {
  canTransition,
  type OrderStatus,
  type PaymentMethod,
} from '@nowcore/shared';
import { PrismaService } from '../../prisma.service.js';

/**
 * The only way an order changes status (docs/05 §4).
 *
 * Every transition is a conditional update — `WHERE id = ? AND status = from`
 * — so two writers racing for the same transition (the browser's payment
 * confirmation and Razorpay's webhook land within milliseconds of each other)
 * cannot both succeed. Exactly one updates a row; the other sees zero and
 * does nothing. The OrderEvent is written in the same transaction, so the
 * history and the status can never disagree.
 */
@Injectable()
export class OrderStateService {
  private readonly log = new Logger('orders');

  constructor(private readonly db: PrismaService) {}

  async transition(
    orderId: string,
    from: OrderStatus,
    to: OrderStatus,
    source: string,
    payload: Prisma.InputJsonValue,
    extra: Prisma.OrderUpdateManyMutationInput = {},
  ): Promise<boolean> {
    if (!canTransition(from, to)) {
      this.log.warn(`refused ${from} → ${to} for ${orderId} (${source})`);
      return false;
    }
    return this.db.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: from },
        data: { ...extra, status: to },
      });
      if (count === 0) return false;
      await tx.orderEvent.create({
        data: { orderId, from, to, source, payload },
      });
      return true;
    });
  }

  /**
   * Payment landed. Idempotent: a second caller finds the order no longer
   * PENDING and returns false. The cart empties only now — a failed payment
   * leaves it intact for another try.
   */
  async markPaid(
    order: { id: string; cartId: string | null },
    source: string,
    payload: Prisma.InputJsonValue,
    method: PaymentMethod | null,
  ): Promise<boolean> {
    const moved = await this.transition(
      order.id,
      'PENDING',
      'PAID',
      source,
      payload,
      method ? { method } : {},
    );
    if (moved && order.cartId)
      await this.db.cartItem.deleteMany({ where: { cartId: order.cartId } });
    return moved;
  }
}
