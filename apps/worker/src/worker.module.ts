import { BullModule } from '@nestjs/bullmq';
import { Module, type DynamicModule } from '@nestjs/common';
import { readEnv, redisConnection, type Env } from './env.js';
import { QUEUES } from './queues.js';
import { LocalFrameStore } from './render/frame-store.js';
import { FRAME_STORE, RenderProcessor } from './render.processor.js';
import { SystemProcessor } from './system.processor.js';

@Module({})
export class WorkerModule {
  static with(env: Env = readEnv()): DynamicModule {
    return {
      module: WorkerModule,
      imports: [
        BullModule.forRoot({ connection: redisConnection(env.REDIS_URL) }),
        BullModule.registerQueue(
          { name: QUEUES.system },
          { name: QUEUES.render },
        ),
      ],
      providers: [
        SystemProcessor,
        RenderProcessor,
        // Local until the hosted Supabase project exists (T-035).
        { provide: FRAME_STORE, useValue: new LocalFrameStore(env.FRAMES_DIR) },
      ],
    };
  }
}
