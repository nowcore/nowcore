import type { Prisma, PrismaClient } from '@nowcore/db';
import {
  canTransition,
  type OrderStatus,
  type PaymentMethod,
} from '@nowcore/shared';

/**
 * The only way an order changes status (docs/05 §4), shared by the API
 * (payments, printer webhooks) and the worker (fulfilment).
 *
 * Every transition is a conditional update — `WHERE id = ? AND status = from`
 * — so two writers racing for the same transition cannot both succeed: one
 * updates a row, the other sees zero and does nothing. The OrderEvent is
 * written in the same transaction, so history and status never disagree.
 * Watched failing: without the `status` condition, a racing checkout verify
 * and webhook paid one order twice (apps/api orders.spec.ts).
 */
export async function transition(
  db: PrismaClient,
  orderId: string,
  from: OrderStatus,
  to: OrderStatus,
  source: string,
  payload: Prisma.InputJsonValue,
  extra: Prisma.OrderUpdateManyMutationInput = {},
): Promise<boolean> {
  if (!canTransition(from, to)) return false;
  return db.$transaction(async (tx) => {
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
 * PENDING and gets false. The cart empties only now — a failed payment leaves
 * it intact for another try.
 */
export async function markPaid(
  db: PrismaClient,
  order: { id: string; cartId: string | null },
  source: string,
  payload: Prisma.InputJsonValue,
  method: PaymentMethod | null,
): Promise<boolean> {
  const moved = await transition(
    db,
    order.id,
    'PENDING',
    'PAID',
    source,
    payload,
    method ? { method } : {},
  );
  if (moved && order.cartId)
    await db.cartItem.deleteMany({ where: { cartId: order.cartId } });
  return moved;
}
export * from './token.js';
export * from './edition.js';
