import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@nowcore/db';
import { transition } from '@nowcore/orders';
import {
  canTransition,
  OrderStatus,
  type AdminOrderDetail,
  type AdminOrderList,
  type AdminOrderRow,
  type Dashboard,
} from '@nowcore/shared';
import { PrismaService } from '../../prisma.service.js';
import { FulfilmentQueue } from '../fulfilment/fulfilment.queue.js';

const CLAIMED = [
  'PAID',
  'FULFILMENT_QUEUED',
  'FULFILMENT_FAILED',
  'PRINTING',
  'SHIPPED',
  'DELIVERED',
] as const;
/** Orders a person must look at. */
export const ATTENTION = ['FULFILMENT_FAILED'] as const;

const include = { items: true } satisfies Prisma.OrderInclude;
type Row = Prisma.OrderGetPayload<{ include: typeof include }>;

function row(o: Row): AdminOrderRow {
  const addr = (o.shippingAddress ?? {}) as { city?: string };
  const n = o.items.reduce((t, i) => t + i.quantity, 0);
  const first = o.items[0];
  return {
    reference: o.reference,
    status: o.status,
    method: o.method,
    email: o.email,
    phone: o.phone,
    city: addr.city ?? null,
    summary: first ? `${first.skuSnap}${n > 1 ? ` +${n - 1}` : ''}` : '—',
    totalPaise: o.totalPaise,
    createdAt: o.createdAt.toISOString(),
  };
}

/** Operations side of the admin (T-069–T-071). */
@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly db: PrismaService,
    private readonly queue: FulfilmentQueue,
  ) {}

  async list(
    status: string | undefined,
    q: string | undefined,
  ): Promise<AdminOrderList> {
    const where: Prisma.OrderWhereInput = {};
    if (status === 'attention') where.status = { in: [...ATTENTION] };
    else if (status && OrderStatus.safeParse(status).success)
      where.status = OrderStatus.parse(status);
    const term = q?.trim();
    if (term) {
      where.OR = [
        { reference: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term.replace(/\D/g, '') || term } },
        {
          items: { some: { skuSnap: { contains: term, mode: 'insensitive' } } },
        },
      ];
    }
    const [orders, grouped] = await Promise.all([
      this.db.order.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.db.order.groupBy({ by: ['status'], _count: true }),
    ]);
    const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
    counts['attention'] = ATTENTION.reduce((t, s) => t + (counts[s] ?? 0), 0);
    return { orders: orders.map(row), counts };
  }

  async detail(reference: string): Promise<AdminOrderDetail> {
    const o = await this.db.order.findUnique({
      where: { reference },
      include: { ...include, events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!o) throw new NotFoundException('no such order');
    const actions: AdminOrderDetail['actions'] = [];
    if (o.status === 'FULFILMENT_FAILED') actions.push('retry');
    if (canTransition(o.status, 'CANCELLED')) actions.push('cancel');
    if (canTransition(o.status, 'REFUNDED')) actions.push('refund');
    return {
      ...row(o),
      address: (o.shippingAddress ?? {}) as Record<string, unknown>,
      podOrderId: o.podOrderId,
      providerOrderId: o.razorpayOrderId,
      trackingUrl: o.trackingUrl,
      subtotalPaise: o.subtotalPaise,
      shippingPaise: o.shippingPaise,
      lines: o.items.map((i) => ({
        title: i.titleSnap,
        sku: i.skuSnap,
        size: i.sizeSnap,
        colour: i.colorSnap,
        pricePaise: i.pricePaise,
        quantity: i.quantity,
      })),
      events: o.events.map((e) => ({
        from: e.from,
        to: e.to,
        source: e.source,
        at: e.createdAt.toISOString(),
        payload: e.payload,
      })),
      actions,
    };
  }

  /**
   * FULFILMENT_FAILED → FULFILMENT_QUEUED, then a fresh job. Fresh id: the
   * failed job is kept for inspection, and BullMQ refuses a second job with
   * the same id — re-adding it would silently do nothing.
   */
  async retry(reference: string, by: string): Promise<void> {
    const o = await this.must(reference);
    const moved = await transition(
      this.db,
      o.id,
      'FULFILMENT_FAILED',
      'FULFILMENT_QUEUED',
      `operator:${by}`,
      { action: 'retry' },
    );
    if (!moved)
      throw new ConflictException(`cannot retry an order that is ${o.status}`);
    await this.queue.submit(o.id, `retry-${Date.now()}`);
  }

  async cancel(reference: string, by: string): Promise<void> {
    const o = await this.must(reference);
    if (
      !(await transition(
        this.db,
        o.id,
        o.status,
        'CANCELLED',
        `operator:${by}`,
        { action: 'cancel' },
      ))
    ) {
      throw new ConflictException(`cannot cancel an order that is ${o.status}`);
    }
  }

  /**
   * Records a refund. The money moves in the payment provider's dashboard —
   * the Razorpay refund API is not wired (no keys) — and this says so in the
   * event, rather than pretending the system refunded anyone.
   */
  async refund(reference: string, by: string, note: string): Promise<void> {
    const o = await this.must(reference);
    const payload = {
      action: 'refund',
      recordedOnly: true,
      note: note.slice(0, 500),
    };
    if (
      !(await transition(
        this.db,
        o.id,
        o.status,
        'REFUNDED',
        `operator:${by}`,
        payload,
      ))
    ) {
      throw new ConflictException(`cannot refund an order that is ${o.status}`);
    }
  }

  async dashboard(
    range: Dashboard['range'],
    now = new Date(),
  ): Promise<Dashboard> {
    const days = range === 'today' ? 0 : range === '7d' ? 7 : 30;
    const since = new Date(now);
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - days);

    const claimed = await this.db.order.findMany({
      where: {
        status: { in: [...CLAIMED] },
        createdAt: { gte: since, lte: now },
      },
      select: {
        id: true,
        totalPaise: true,
        method: true,
        events: {
          where: { to: { in: ['PAID', 'PRINTING'] } },
          select: { to: true, createdAt: true },
        },
      },
    });
    const revenuePaise = claimed.reduce((t, o) => t + o.totalPaise, 0);
    const cod = claimed.filter((o) => o.method === 'COD').length;

    // Print SLA: only orders paid more than 24 h ago can be judged.
    const judged = claimed
      .map((o) => ({
        paid: o.events.find((e) => e.to === 'PAID')?.createdAt,
        printing: o.events.find((e) => e.to === 'PRINTING')?.createdAt,
      }))
      .filter(
        (o): o is { paid: Date; printing: Date | undefined } =>
          !!o.paid && now.getTime() - o.paid.getTime() > 24 * 3_600_000,
      );
    const onTime = judged.filter(
      (o) =>
        o.printing && o.printing.getTime() - o.paid.getTime() <= 24 * 3_600_000,
    ).length;

    return {
      range,
      revenuePaise,
      orders: claimed.length,
      aovPaise: claimed.length ? Math.round(revenuePaise / claimed.length) : 0,
      codShare: claimed.length ? cod / claimed.length : 0,
      printSla: judged.length ? onTime / judged.length : null,
      needsAttention: await this.db.order.count({
        where: { status: { in: [...ATTENTION] } },
      }),
    };
  }

  private async must(reference: string) {
    const o = await this.db.order.findUnique({ where: { reference } });
    if (!o) throw new NotFoundException('no such order');
    return o;
  }
}
