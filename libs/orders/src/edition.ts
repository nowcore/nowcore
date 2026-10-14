import type { Prisma } from '@nowcore/db';

/**
 * The edition cap under a rush (T-096, ADR-008). Watched failing: 500 buyers
 * released at once on an edition of 100 all paid — the check counted only
 * paid orders, and every buyer was checked before anyone had paid.
 *
 * An unpaid order holds its pieces for HOLD_MS, long enough to finish a UPI
 * or card payment. Checkout counts paid orders plus live holds, under a lock
 * per drop, so the rush is served in turn and the holds never exceed the cap.
 */
export const HOLD_MS = 15 * 60_000;

/** Statuses whose pieces are spoken for for good. */
export const CLAIMED = [
  'PAID',
  'FULFILMENT_QUEUED',
  'FULFILMENT_FAILED',
  'PRINTING',
  'SHIPPED',
  'DELIVERED',
] as const;

type Db = Pick<Prisma.TransactionClient, 'orderItem' | '$executeRaw'>;

/** Arbitrary, fixed: the first half of the two-int advisory lock key, so these never collide with other locks. */
const EDITION_LOCK = 9014;

/** Serialise checkouts for one drop until the surrounding transaction ends. */
export async function lockEdition(tx: Db, dropId: string): Promise<void> {
  // executeRaw: Prisma cannot deserialise the void this function returns.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${EDITION_LOCK}::int, hashtext(${dropId}))`;
}

/** Pieces of a drop bought, or held by an unpaid order younger than HOLD_MS. Orders are found by SKU prefix. */
export async function claimed(
  db: Db,
  dropNumber: number,
  now: Date,
  exceptOrderId?: string,
): Promise<number> {
  const prefix = `NC-${String(dropNumber).padStart(3, '0')}-`;
  const r = await db.orderItem.aggregate({
    _sum: { quantity: true },
    where: {
      skuSnap: { startsWith: prefix },
      order: {
        ...(exceptOrderId ? { id: { not: exceptOrderId } } : {}),
        OR: [
          { status: { in: [...CLAIMED] } },
          {
            status: 'PENDING',
            createdAt: { gt: new Date(now.getTime() - HOLD_MS) },
          },
        ],
      },
    },
  });
  return r._sum.quantity ?? 0;
}
