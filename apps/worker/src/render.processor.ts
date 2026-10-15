import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { ObjectStore } from '@nowcore/storage';
import { RenderJob } from '@nowcore/shared';
import { PrismaService } from './prisma.service.js';
import { type FrameStore } from './render/frame-store.js';
import {
  renderColourway,
  type ColourwayResult,
} from './render/render-colourway.js';
import { QUEUES } from './queues.js';

export const FRAME_STORE = Symbol('FRAME_STORE');
export const ARTWORK_STORE = Symbol('ARTWORK_STORE');

/**
 * `render.turntable` (T-034, T-066). Its own queue so a backlog of renders can
 * never delay a POD submission. Concurrency 1: a render is CPU-bound, and two
 * at once just halves the speed of each.
 *
 * On success the colourway's variants point at the new frames — that is how
 * the admin sees progress, and how the publish check knows it is rendered.
 * Over-budget frames throw in renderColourway and are never stored.
 */
@Processor(QUEUES.render, { concurrency: 1 })
export class RenderProcessor extends WorkerHost {
  private readonly log = new Logger('render');

  constructor(
    @Inject(FRAME_STORE) private readonly store: FrameStore,
    private readonly db: PrismaService,
    @Inject(ARTWORK_STORE) private readonly artwork: ObjectStore,
  ) {
    super();
  }

  async process(job: Job): Promise<ColourwayResult> {
    const j = RenderJob.parse(job.data);
    const artwork = await this.artwork.get(j.artworkKey);
    const colour = `${j.colourCode}-${j.rev}`;
    const result = await renderColourway(
      { drop: j.drop, colour, garmentHex: j.garmentHex, artwork },
      this.store,
    );
    const prefix = result.still.replace(/\/still\.avif$/, '');
    await this.db.variant.updateMany({
      where: { productId: j.productId, colorName: j.colourName },
      data: { sequenceUrl: prefix, mockupUrl: result.still },
    });
    this.log.log(
      `${j.drop}/${colour}: ${result.desktop.urls.length}+${result.mobile.urls.length} frames`,
    );
    return result;
  }
}
