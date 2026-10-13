'use client';
import { useEffect } from 'react';
import { useTier } from './context.js';

/**
 * Weighted scroll on the full tier only — what makes a scrub feel like film
 * rather than a slider. Lenis is imported dynamically, after first paint, so
 * it is never part of the initial-route budget. Stages keep working without
 * it: they read the real scroll position, which Lenis only smooths.
 */
export function SmoothScroll() {
  const tier = useTier();
  useEffect(() => {
    if (tier !== 'full') return;
    let stop: () => void = () => undefined;
    let cancelled = false;
    void import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return;
      const lenis = new Lenis({ lerp: 0.1 });
      let raf = requestAnimationFrame(function loop(t) {
        lenis.raf(t);
        raf = requestAnimationFrame(loop);
      });
      stop = () => {
        cancelAnimationFrame(raf);
        lenis.destroy();
      };
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [tier]);
  return null;
}
