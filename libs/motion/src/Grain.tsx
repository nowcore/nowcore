'use client';
import { useTier } from './context.js';

/**
 * Fixed grain over everything, 5% (docs/10). Hides banding on dark gradients.
 * Off below the full tier: it is a full-screen composited layer, and that is
 * the first thing to cut on a weak GPU.
 */
export function Grain() {
  const tier = useTier();
  if (tier !== 'full') return null;
  return (
    <svg className="nc-grain" aria-hidden="true" focusable="false">
      <filter id="nc-grain-filter">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.85"
          numOctaves="3"
          stitchTiles="stitch"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#nc-grain-filter)" />
    </svg>
  );
}
