import { Global, Module, type DynamicModule } from '@nestjs/common';
import { ENV, readEnv, type Env } from './env.js';
import { HealthController } from './health.controller.js';
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
      controllers: [HealthController],
      providers: [{ provide: ENV, useValue: env }, PrismaService],
      exports: [ENV, PrismaService],
    };
  }
}
