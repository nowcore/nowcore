import { Global, Module } from '@nestjs/common';
import { SandboxPrinter, type PodProvider } from '@nowcore/pod';
import { ENV, type Env } from '../../env.js';
import { FulfilmentQueue } from './fulfilment.queue.js';

export const POD_PROVIDER = Symbol('POD_PROVIDER');

@Global()
@Module({
  providers: [
    FulfilmentQueue,
    {
      provide: POD_PROVIDER,
      inject: [ENV],
      // Printrove joins here as a second branch when its adapter exists.
      useFactory: (env: Env): PodProvider =>
        new SandboxPrinter(env.POD_SANDBOX_SECRET),
    },
  ],
  exports: [FulfilmentQueue, POD_PROVIDER],
})
export class PodModule {}
