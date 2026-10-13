import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@nowcore/db';
import { transition } from '@nowcore/orders';
import type { PodProvider, PodStatus } from '@nowcore/pod';
import type { OrderStatus } from '@nowcore/shared';
import { PrismaService } from '../../prisma.service.js';
import { FulfilmentQueue } from './fulfilment.queue.js';
import { POD_PROVIDER } from './pod.module.js';

/** Which of our transitions a printer status means, and from where. */
const MOVES: Record<PodStatus, { from: OrderStatus; to: OrderStatus } | null> =
  {
    // The worker already moves an accepted order to PRINTING; a printer saying
    // so again is a no-op, not an error.
    PRINTING: null,
    SHIPPED: { from: 'PRINTING', to: 'SHIPPED' },
    DELIVERED: { from: 'SHIPPED', to: 'DELIVERED' },
    RTO: { from: 'SHIPPED', to: 'RTO' },
  };

/**
 * Printer webhooks (T-061), in the same five steps as payment webhooks
 * (docs/05 §3): signature over raw bytes, event-id dedup, find the order,
 * guarded transition, 200 for anything understood.
 */
@Injectable()
export class PodEventsService {
  constructor(
    private readonly db: PrismaService,
    private readonly queue: FulfilmentQueue,
    @Inject(POD_PROVIDER) private readonly pod: PodProvider,
  ) {}

  async receive(
    raw: Buffer | undefined,
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<{ ok: true; duplicate?: true }> {
    if (!raw || !this.pod.verifyWebhook(raw, headers))
      throw new UnauthorizedException('bad signature');
    const event = this.pod.parseWebhook(body);
    try {
      await this.db.webhookEvent.create({
        data: { provider: `pod:${this.pod.name}`, eventId: event.eventId },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        return { ok: true, duplicate: true };
      throw e;
    }
    const move = MOVES[event.status];
    if (!move) return { ok: true };
    const order = await this.db.order.findUnique({
      where: { podOrderId: event.podOrderId },
    });
    if (!order) return { ok: true };
    const moved = await transition(
      this.db,
      order.id,
      move.from,
      move.to,
      `pod:${this.pod.name}`,
      { eventId: event.eventId },
      event.trackingUrl ? { trackingUrl: event.trackingUrl } : {},
    );
    if (moved && move.to === 'SHIPPED')
      await this.queue.tell(order.id, 'shipped');
    return { ok: true };
  }
}
