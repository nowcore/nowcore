import {
  Controller,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { PodProvider } from '@nowcore/pod';
import { POD_PROVIDER } from './pod.module.js';
import { PodEventsService } from './pod-events.service.js';

@Controller('webhooks/pod')
export class PodWebhooksController {
  constructor(
    private readonly events: PodEventsService,
    @Inject(POD_PROVIDER) private readonly pod: PodProvider,
  ) {}

  @Post(':provider')
  @HttpCode(200)
  receive(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<FastifyRequest>,
  ) {
    if (provider !== this.pod.name) throw new NotFoundException();
    return this.events.receive(req.rawBody, req.headers, req.body);
  }
}
