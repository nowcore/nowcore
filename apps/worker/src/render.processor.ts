import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUES } from './queues.js';
import { type FrameStore } from './render/frame-store.js';
import {
  renderColourway,
  type ColourwayResult,
} from './render/render-colourway.js';

export const FRAME_STORE = Symbol('FRAME_STORE');

export interface RenderJob {
  drop: string;
  colour: string;
  garmentHex: string;
  /** Base64 PNG. Becomes a Storage key once uploads exist (T-066). */
  artworkBase64: string;
}

/**
 * `render.turntable` (T-034). Its own queue so a backlog of renders can never
 * delay a POD submission. Concurrency 1: a render is CPU-bound, and two at
 * once just halves the speed of each.
 */
@Processor(QUEUES.render, { concurrency: 1 })
export class RenderProcessor extends WorkerHost {
  private readonly log = new Logger('render');

  constructor(@Inject(FRAME_STORE) private readonly store: FrameStore) {
    super();
  }

  async process(job: Job<RenderJob>): Promise<ColourwayResult> {
    const { drop, colour, garmentHex, artworkBase64 } = job.data;
    const result = await renderColourway(
      {
        drop,
        colour,
        garmentHex,
        artwork: Buffer.from(artworkBase64, 'base64'),
      },
      this.store,
    );
    this.log.log(
      `${drop}/${colour}: ${result.desktop.urls.length}+${result.mobile.urls.length} frames`,
    );
    return result;
  }
}
