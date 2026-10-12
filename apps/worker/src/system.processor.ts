import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUES } from './queues.js';

/**
 * The no-op job (T-026). It exists to prove the plumbing: a job enqueued on
 * Redis is picked up by a live worker and completes. Every real processor
 * that follows has the same shape.
 */
@Processor(QUEUES.system)
export class SystemProcessor extends WorkerHost {
  private readonly log = new Logger('system');

  async process(job: Job<{ at: string }>): Promise<{ pong: string }> {
    this.log.log(`ping ${job.id}`);
    return { pong: job.data.at };
  }
}
