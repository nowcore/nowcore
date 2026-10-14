import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import {
  isNoise,
  normalise,
  QUEUE,
  TrendIngestJob,
  TrendSource,
} from '@nowcore/shared';
import type { Env } from '../env.js';
import { PrismaService } from '../prisma.service.js';
import { TREND_FETCH, WORKER_ENV } from '../tokens.js';
import { configured, pull, type Fetch } from './sources.js';

/**
 * `trends.ingest` (T-074): hourly, one job per configured source. Upserts on
 * (source, externalId), so a story seen every hour is one row whose score and
 * last sighting move — the radar's 24 h window reads that sighting. A failed
 * pull retries with backoff and never touches another source's job.
 */
@Processor(QUEUE.trends, { concurrency: 1 })
export class TrendsProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly log = new Logger('trends.ingest');

  constructor(
    private readonly db: PrismaService,
    @InjectQueue(QUEUE.trends) private readonly queue: Queue,
    @Inject(TREND_FETCH) private readonly fetch: Fetch,
    @Inject(WORKER_ENV) private readonly env: Env,
  ) {
    super();
  }

  /** One repeatable job per source that has credentials; the rest are removed, so turning one off sticks. */
  async onApplicationBootstrap(): Promise<void> {
    if (this.env.TRENDS === 'off') return;
    const on = configured(this.env);
    for (const source of TrendSource.options) {
      const id = `ingest-${source}`;
      if (!on.includes(source)) {
        await this.queue.removeJobScheduler(id);
        continue;
      }
      await this.queue.upsertJobScheduler(
        id,
        { every: 3_600_000 },
        {
          name: source,
          data: { source },
          opts: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 60_000 },
          },
        },
      );
    }
    this.log.log(`ingesting hourly from ${on.join(', ')}`);
  }

  async process(job: Job): Promise<{ landed: number; noise: number }> {
    const { source } = TrendIngestJob.parse(job.data);
    const signals = await pull(source, this.fetch, this.env);
    const now = new Date();
    let landed = 0;
    for (const s of signals) {
      if (isNoise(s.term)) continue;
      const score = normalise(s.source, s.raw);
      await this.db.trend.upsert({
        where: {
          source_externalId: { source: s.source, externalId: s.externalId },
        },
        create: {
          source: s.source,
          externalId: s.externalId,
          term: s.term,
          score,
          url: s.url,
          capturedAt: now,
          seenAt: now,
        },
        update: { term: s.term, score, url: s.url, seenAt: now },
      });
      landed++;
    }
    return { landed, noise: signals.length - landed };
  }
}
