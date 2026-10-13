import { Module, type DynamicModule } from '@nestjs/common';
import { DevPressController } from './dev-press.controller.js';
import { PodEventsService } from './pod-events.service.js';
import { PodWebhooksController } from './pod-webhooks.controller.js';

@Module({})
export class FulfilmentModule {
  static with(pod: 'sandbox'): DynamicModule {
    return {
      module: FulfilmentModule,
      controllers: [
        PodWebhooksController,
        ...(pod === 'sandbox' ? [DevPressController] : []),
      ],
      providers: [PodEventsService],
    };
  }
}
