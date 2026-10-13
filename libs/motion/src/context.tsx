'use client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createProgressStore, type ProgressStore } from './store.js';
import { detectTier, readSignals, type Tier } from './tier.js';

const TierContext = createContext<Tier>('static');
const StageContext = createContext<ProgressStore | null>(null);

/**
 * Decides the tier once on the client. The server renders `static`, which is
 * also the correct first paint for every tier: the fallback still is the LCP
 * element by design, and motion is layered on after hydration.
 */
export function MotionProvider({
  children,
  force,
}: {
  children: ReactNode;
  force?: Tier;
}) {
  const [tier, setTier] = useState<Tier>(force ?? 'static');
  useEffect(() => {
    if (force) return;
    // `?tier=reduced` forces a tier, for QA and the motion check. Not a
    // feature: it only lets a tier be opened on purpose, never chosen for a
    // buyer.
    const asked = new URLSearchParams(window.location.search).get('tier');
    if (asked === 'full' || asked === 'reduced' || asked === 'static') {
      setTier(asked);
      return;
    }
    setTier(detectTier(readSignals(window)));
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onChange = () => setTier(detectTier(readSignals(window)));
    mq?.addEventListener?.('change', onChange);
    return () => mq?.removeEventListener?.('change', onChange);
  }, [force]);
  return (
    <TierContext.Provider value={tier}>
      <div data-motion-tier={tier} style={{ display: 'contents' }}>
        {children}
      </div>
    </TierContext.Provider>
  );
}

export function useTier(): Tier {
  return useContext(TierContext);
}

export const StageProvider = StageContext.Provider;

/** The enclosing stage's store. Outside a stage, a store pinned at 0. */
export function useStageStore(): ProgressStore {
  const store = useContext(StageContext);
  const [fallback] = useState(() => createProgressStore(0));
  return store ?? fallback;
}

/**
 * Progress quantised to `steps`, so a component re-renders only when it
 * crosses a boundary — ten times per scroll for steps=10, not sixty per second.
 */
export function useStageStep(steps: number): number {
  const store = useStageStore();
  return useSyncExternalStore(
    store.subscribe,
    () => Math.min(steps, Math.floor(store.get() * steps)),
    () => 0,
  );
}
