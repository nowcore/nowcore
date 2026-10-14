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
import { LocalFrameStore } from './render/frame-store.js';
import { FRAME_STORE, RenderProcessor } from './render.processor.js';
import { SystemProcessor } from './system.processor.js';
import { MAILER, POD_PROVIDER, WORKER_ENV } from './tokens.js';

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
          { name: QUEUES.render },
          { name: QUEUE.pod },
          { name: QUEUE.notify },
        ),
      ],
      providers: [
        { provide: WORKER_ENV, useValue: env },
        PrismaService,
        SystemProcessor,
        RenderProcessor,
        PodSubmitProcessor,
        NotifyProcessor,
        // Local until the hosted Supabase project exists (T-035).
        { provide: FRAME_STORE, useValue: new LocalFrameStore(env.FRAMES_DIR) },
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
