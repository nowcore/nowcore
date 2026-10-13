/**
 * Quality tiers (docs/10-design-system.md). Chosen once, from what the device
 * tells us, so the same design arrives with as much motion as it can carry.
 *
 *   full     72 frames, smooth scroll, grain, magnetic cursor
 *   reduced  24 frames, native scroll, no grain — slow network or weak CPU
 *   static   one still, no pinning — the person asked for reduced motion
 *
 * `prefers-reduced-motion` always wins: it is an accessibility request, not
 * a performance hint, and no amount of bandwidth overrides it.
 */
export type Tier = 'full' | 'reduced' | 'static';

export interface TierSignals {
  reducedMotion: boolean;
  saveData?: boolean | undefined;
  /** navigator.connection.effectiveType: 'slow-2g' | '2g' | '3g' | '4g' */
  effectiveType?: string | undefined;
  hardwareConcurrency?: number | undefined;
}

export function detectTier(s: TierSignals): Tier {
  if (s.reducedMotion) return 'static';
  if (s.saveData) return 'reduced';
  if (s.effectiveType && s.effectiveType !== '4g') return 'reduced';
  if (s.hardwareConcurrency !== undefined && s.hardwareConcurrency < 4)
    return 'reduced';
  return 'full';
}

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

/** Reads the signals from a browser. Server code never calls this. */
export function readSignals(w: Window): TierSignals {
  const nav = w.navigator as Navigator & {
    connection?: NetworkInformationLike;
  };
  return {
    reducedMotion:
      w.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    saveData: nav.connection?.saveData,
    effectiveType: nav.connection?.effectiveType,
    hardwareConcurrency: nav.hardwareConcurrency,
  };
}

/** How many turntable frames each tier loads. */
export const FRAMES_PER_TIER: Record<Tier, number> = {
  full: 72,
  reduced: 24,
  static: 1,
};
