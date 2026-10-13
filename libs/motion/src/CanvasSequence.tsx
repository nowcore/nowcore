'use client';
import { useEffect, useRef, useState } from 'react';
import { useStageStore, useTier } from './context.js';
import { segment, frameAt, prewarmOrder } from './progress.js';
import { FRAMES_PER_TIER } from './tier.js';

/**
 * The turntable (T-031). A pre-rendered image sequence painted to one canvas
 * and scrubbed by the enclosing stage — morphowater.com's technique; its hero
 * fallback is frame 376 of exactly this.
 *
 * Order of events is the whole design:
 *   1. The server renders the fallback <img>. It is the LCP element, it is
 *      what the static tier keeps, and it never waits on JavaScript.
 *   2. After hydration, frames are fetched and decoded with createImageBitmap,
 *      which decodes off the main thread — a decode on the main thread shows
 *      up as one long task per frame, a sawtooth in the trace.
 *   3. Frames near the current position load first (±8), the rest in idle time.
 *   4. The canvas covers the fallback only once a real frame is on it.
 *
 * Drawing happens in the store subscription, not in React: scrubbing never
 * re-renders a component.
 */
export function CanvasSequence({
  frames,
  reducedFrames,
  fallback,
  alt,
  width,
  height,
  range = [0, 1],
  className,
}: {
  /** Full-tier URLs in order. */
  frames: readonly string[];
  /**
   * A smaller set rendered for the reduced tier (24 frames at 480px). Without
   * it the reduced tier takes every third full-size frame — the right arc,
   * but four times the bytes it needs.
   */
  reducedFrames?: readonly string[];
  /** The still: server-rendered, LCP, and all the static tier shows. */
  fallback: string;
  alt: string;
  /** Intrinsic frame size, for layout and the canvas backing store. */
  width: number;
  height: number;
  /** The part of the stage's progress this sequence spans. */
  range?: readonly [number, number];
  className?: string;
}) {
  const tier = useTier();
  const store = useStageStore();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [painted, setPainted] = useState(false);

  const urls =
    tier === 'static'
      ? []
      : tier === 'reduced' && reducedFrames?.length
        ? [...reducedFrames]
        : thin(frames, FRAMES_PER_TIER[tier]);
  const urlKey = urls.join('|');
  const [start, end] = range;

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx || urls.length === 0) return;

    const bitmaps = new Map<number, ImageBitmap>();
    const pending = new Set<number>();
    const controller = new AbortController();
    let drawn = -1;
    let alive = true;

    const draw = () => {
      const want = frameAt(segment(store.get(), start, end), urls.length);
      // Nearest decoded frame, so a fast scroll shows something close rather
      // than nothing.
      let best = -1;
      for (let d = 0; d < urls.length && best === -1; d++) {
        if (bitmaps.has(want - d)) best = want - d;
        else if (bitmaps.has(want + d)) best = want + d;
      }
      if (best === -1 || best === drawn) return;
      const bmp = bitmaps.get(best);
      if (!bmp) return;
      ctx.clearRect(0, 0, el.width, el.height);
      ctx.drawImage(bmp, 0, 0, el.width, el.height);
      drawn = best;
      setPainted(true);
    };

    const load = async (i: number) => {
      if (bitmaps.has(i) || pending.has(i)) return;
      pending.add(i);
      try {
        const res = await fetch(urls[i] as string, {
          signal: controller.signal,
        });
        const bmp = await createImageBitmap(await res.blob());
        if (!alive) return bmp.close();
        bitmaps.set(i, bmp);
        draw();
      } catch {
        // A missing frame is not an error worth surfacing: the nearest
        // decoded frame, or the fallback still, stands in.
      } finally {
        pending.delete(i);
      }
    };

    const prewarm = () => {
      const center = frameAt(segment(store.get(), start, end), urls.length);
      prewarmOrder(center, urls.length).forEach((i) => void load(i));
    };

    // The rest of the sequence, a few at a time, when the browser is idle.
    const idle = (cb: () => void) =>
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(cb)
        : setTimeout(cb, 200);
    let next = 0;
    const backfill = () => {
      if (!alive) return;
      for (let n = 0; n < 4 && next < urls.length; n++, next++) void load(next);
      if (next < urls.length) idle(backfill);
    };

    prewarm();
    idle(backfill);
    const unsubscribe = store.subscribe(() => {
      prewarm();
      draw();
    });

    return () => {
      alive = false;
      controller.abort();
      unsubscribe();
      bitmaps.forEach((b) => b.close());
    };
    // `urls` is rebuilt every render; its joined key is what actually changes.
  }, [urlKey, store, start, end]);

  return (
    <div
      className={className}
      style={{ position: 'relative', aspectRatio: `${width} / ${height}` }}
    >
      <img
        src={fallback}
        alt={alt}
        width={width}
        height={height}
        fetchPriority="high"
        decoding="async"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          opacity: painted ? 0 : 1,
        }}
      />
      {urls.length > 0 && (
        <canvas
          ref={canvas}
          width={width}
          height={height}
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: painted ? 1 : 0,
          }}
        />
      )}
    </div>
  );
}

/** Every k-th URL so `count` frames still cover the full turn. */
export function thin<T>(all: readonly T[], count: number): T[] {
  if (all.length <= count) return [...all];
  const step = all.length / count;
  return Array.from(
    { length: count },
    (_, i) => all[Math.floor(i * step)] as T,
  );
}
