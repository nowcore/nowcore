import {
  BadRequestException,
  Controller,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { SandboxPrinter, type PodProvider, type PodStatus } from '@nowcore/pod';
import { PrismaService } from '../../prisma.service.js';
import { POD_PROVIDER } from './pod.module.js';
import { PodEventsService } from './pod-events.service.js';

const NEXT: Partial<Record<string, PodStatus>> = {
  PRINTING: 'SHIPPED',
  SHIPPED: 'DELIVERED',
};

/**
 * Plays the press for the sandbox printer: moves an order to its next printer
 * status by sending a *signed* webhook through the real handler, so local runs
 * exercise exactly the path a printer would. Sandbox only; the sandbox is
 * refused in production.
 */
@Controller('dev/pod')
export class DevPressController {
  constructor(
    private readonly db: PrismaService,
    private readonly events: PodEventsService,
    @Inject(POD_PROVIDER) private readonly pod: PodProvider,
  ) {}

  @Post(':reference/advance')
  async advance(@Param('reference') reference: string) {
    if (!(this.pod instanceof SandboxPrinter)) throw new NotFoundException();
    const order = await this.db.order.findUnique({ where: { reference } });
    if (!order?.podOrderId)
      throw new NotFoundException('not at the printer yet');
    const next = NEXT[order.status];
    if (!next) throw new BadRequestException(`nothing follows ${order.status}`);
    const { body, signature } = this.pod.webhook(order.podOrderId, next);
    return this.events.receive(
      Buffer.from(body),
      { 'x-sandbox-signature': signature },
      JSON.parse(body),
    );
  }
}
