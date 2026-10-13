import {
  Controller,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Prisma } from '@nowcore/db';
import { PrismaService } from '../../prisma.service.js';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../payments/payment-provider.js';
import { OrderStateService } from './order-state.service.js';

/**
 * Payment webhooks (T-054, T-055), in the five steps of docs/05 §3:
 *   1. verify the signature over the raw bytes — before parsing anything
 *   2. insert the event id; a unique violation means "already handled"
 *   3. find the order
 *   4. transition through OrderStateService
 *   5. answer 200 for anything understood, even when it changed nothing —
 *      an error would make the provider retry forever
 */
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly db: PrismaService,
    private readonly state: OrderStateService,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
  ) {}

  @Post(':provider')
  @HttpCode(200)
  async receive(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<FastifyRequest>,
  ): Promise<{ ok: true; duplicate?: true }> {
    if (provider !== this.payments.name) throw new NotFoundException();
    const raw = req.rawBody;
    if (!raw || !this.payments.verifyWebhook(raw, req.headers))
      throw new UnauthorizedException('bad signature');

    const event = this.payments.parseWebhook(req.body, req.headers);
    try {
      await this.db.webhookEvent.create({
        data: { provider, eventId: event.eventId },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        return { ok: true, duplicate: true };
      throw e;
    }

    if (event.kind !== 'paid' || !event.providerOrderId) return { ok: true };
    const order = await this.db.order.findUnique({
      where: { razorpayOrderId: event.providerOrderId },
    });
    if (!order) return { ok: true };
    await this.state.markPaid(
      order,
      `${provider}:webhook`,
      { eventId: event.eventId, paymentId: event.paymentId },
      event.method,
    );
    return { ok: true };
  }
}
