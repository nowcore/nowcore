import { BullModule } from '@nestjs/bullmq';
import { Module, type DynamicModule } from '@nestjs/common';
import { SandboxPrinter } from '@nowcore/pod';
import { QUEUE } from '@nowcore/shared';
import { readEnv, redisConnection, type Env } from './env.js';
import { ConsoleMailer, ResendMailer } from './fulfilment/mailer.js';
import { NotifyProcessor } from './fulfilment/notify.processor.js';
import { PodSubmitProcessor } from './fulfilment/pod-submit.processor.js';
import { PrismaService } from './prisma.service.js';
import { QUEUES } from './queues.js';
import { LocalStore, SupabaseStore } from '@nowcore/storage';
import { LocalFrameStore, ObjectFrameStore } from './render/frame-store.js';
import {
  ARTWORK_STORE,
  FRAME_STORE,
  RenderProcessor,
} from './render.processor.js';
import { SystemProcessor } from './system.processor.js';
import { MAILER, POD_PROVIDER, TREND_FETCH, WORKER_ENV } from './tokens.js';
import { TrendsProcessor } from './trends/trends.processor.js';

@Module({})
export class WorkerModule {
  static with(env: Env = readEnv()): DynamicModule {
    return {
      module: WorkerModule,
      imports: [
        BullModule.forRoot({
          connection: redisConnection(env.REDIS_URL),
          prefix: env.QUEUE_PREFIX,
        }),
        BullModule.registerQueue(
          { name: QUEUES.system },
          { name: QUEUE.render },
          { name: QUEUE.pod },
          { name: QUEUE.notify },
          { name: QUEUE.trends },
        ),
      ],
      providers: [
        { provide: WORKER_ENV, useValue: env },
        PrismaService,
        SystemProcessor,
        RenderProcessor,
        PodSubmitProcessor,
        NotifyProcessor,
        TrendsProcessor,
        { provide: TREND_FETCH, useValue: fetch },
        // Disk locally; Supabase Storage when hosted (T-035).
        {
          provide: FRAME_STORE,
          useValue:
            env.STORAGE === 'supabase'
              ? new ObjectFrameStore(
                  new SupabaseStore(
                    env.SUPABASE_URL as string,
                    env.SUPABASE_SECRET_KEY as string,
                    'frames',
                  ),
                )
              : new LocalFrameStore(env.FRAMES_DIR),
        },
        {
          provide: ARTWORK_STORE,
          useValue:
            env.STORAGE === 'supabase'
              ? new SupabaseStore(
                  env.SUPABASE_URL as string,
                  env.SUPABASE_SECRET_KEY as string,
                  'artwork',
                )
              : new LocalStore(env.STORAGE_DIR),
        },
        // Printrove joins here when its adapter exists (T-059).
        {
          provide: POD_PROVIDER,
          useValue: new SandboxPrinter(env.POD_SANDBOX_SECRET),
        },
        {
          provide: MAILER,
          useValue:
            env.MAILER === 'resend' && env.RESEND_API_KEY
              ? new ResendMailer(env.RESEND_API_KEY, env.MAIL_FROM)
              : new ConsoleMailer(),
        },
      ],
    };
  }
}
