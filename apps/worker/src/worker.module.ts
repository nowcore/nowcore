import { BullModule } from '@nestjs/bullmq';
import { Module, type DynamicModule } from '@nestjs/common';
import { readEnv, redisConnection, type Env } from './env.js';
import { QUEUES } from './queues.js';
import { SystemProcessor } from './system.processor.js';

@Module({})
export class WorkerModule {
  static with(env: Env = readEnv()): DynamicModule {
    return {
      module: WorkerModule,
      imports: [
        BullModule.forRoot({ connection: redisConnection(env.REDIS_URL) }),
        BullModule.registerQueue({ name: QUEUES.system }),
      ],
      providers: [SystemProcessor],
    };
  }
}
