import { Module, type DynamicModule } from '@nestjs/common';
import { FakePayController } from './fake-pay.controller.js';
import { OrderStateService } from './order-state.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { ReconcileService } from './reconcile.service.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({})
export class OrdersModule {
  /** The fake pay route exists only when the fake provider does. */
  static with(payments: 'razorpay' | 'fake'): DynamicModule {
    return {
      module: OrdersModule,
      controllers: [
        OrdersController,
        WebhooksController,
        ...(payments === 'fake' ? [FakePayController] : []),
      ],
      providers: [OrdersService, OrderStateService, ReconcileService],
      exports: [OrderStateService],
    };
  }
}
