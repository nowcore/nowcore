import {
  FRAME_BUDGET,
  frameKey,
  stillKey,
  type FrameStore,
} from './frame-store.js';
import { renderTurntable } from './turntable.js';

export interface ColourwayJob {
  drop: string;
  colour: string;
  garmentHex: string;
  artwork: Buffer;
}

export interface ColourwayResult {
  still: string;
  desktop: { urls: string[]; bytes: number };
  mobile: { urls: string[]; bytes: number };
}

/**
 * One colourway, both sets: 72 frames at 800px for the full tier, 24 at 480px
 * for the reduced tier (T-036). Refuses to store a set over budget — that is
 * the moment to find out, not when a buyer on 4G finds out.
 */
export async function renderColourway(
  job: ColourwayJob,
  store: FrameStore,
): Promise<ColourwayResult> {
  const desktop = await renderTurntable({
    artwork: job.artwork,
    garmentHex: job.garmentHex,
    frames: 72,
    width: 800,
  });
  const mobile = await renderTurntable({
    artwork: job.artwork,
    garmentHex: job.garmentHex,
    frames: 24,
    width: 480,
    quality: 45,
  });

  if (desktop.bytes > FRAME_BUDGET.desktop) {
    throw new Error(
      `${job.drop}/${job.colour}: desktop set is ${kb(desktop.bytes)}, budget ${kb(FRAME_BUDGET.desktop)}`,
    );
  }
  if (mobile.bytes > FRAME_BUDGET.mobile) {
    throw new Error(
      `${job.drop}/${job.colour}: mobile set is ${kb(mobile.bytes)}, budget ${kb(FRAME_BUDGET.mobile)}`,
    );
  }

  const put = (set: 'd' | 'm', frames: Buffer[]) =>
    Promise.all(
      frames.map((f, i) =>
        store.put(frameKey(job.drop, job.colour, set, i), f),
      ),
    );

  return {
    still: await store.put(stillKey(job.drop, job.colour), desktop.still),
    desktop: { urls: await put('d', desktop.frames), bytes: desktop.bytes },
    mobile: { urls: await put('m', mobile.frames), bytes: mobile.bytes },
  };
}

const kb = (b: number) => `${(b / 1024).toFixed(0)} KB`;
