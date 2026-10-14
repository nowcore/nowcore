import { Global, Module, type DynamicModule } from '@nestjs/common';
import { ENV, readEnv, type Env } from './env.js';
import { HealthController } from './health.controller.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AssetsModule } from './modules/assets/assets.module.js';
import { CartModule } from './modules/cart/cart.module.js';
import { FulfilmentModule } from './modules/fulfilment/fulfilment.module.js';
import { PodModule } from './modules/fulfilment/pod.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { CatalogueModule } from './modules/catalogue/catalogue.module.js';
import { PrismaService } from './prisma.service.js';

/**
 * The composition root. Domain modules arrive one per bounded context under
 * `modules/` — drops, products, orders, payments, fulfilment, trends
 * (docs/04-hld.md §4) — with the tasks that build them.
 */
@Global()
@Module({})
export class AppModule {
  static with(env: Env = readEnv()): DynamicModule {
    return {
      module: AppModule,
      imports: [
        CatalogueModule,
        CartModule,
        PaymentsModule,
        OrdersModule.with(env.PAYMENTS),
        PodModule,
        FulfilmentModule.with(env.POD),
        AdminModule,
        AssetsModule,
      ],
      controllers: [HealthController],
      providers: [{ provide: ENV, useValue: env }, PrismaService],
      exports: [ENV, PrismaService],
    };
  }
}
