'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StageProvider, useTier } from './context.js';
import { stageProgress } from './progress.js';
import { createProgressStore } from './store.js';

/**
 * Progress through a section without pinning it. The product page needs a
 * turntable that turns as the long column of specs scrolls past; the
 * turntable's own column is CSS-sticky, so nothing here pins.
 * Static tier: progress holds at 0, so the still stays face-on.
 */
export function ScrollTrack({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const tier = useTier();
  const ref = useRef<HTMLDivElement>(null);
  const [store] = useState(() => createProgressStore(0));

  useEffect(() => {
    const el = ref.current;
    if (!el || tier === 'static') return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      store.set(stageProgress(r.top, r.height, window.innerHeight));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [tier, store]);

  return (
    <div ref={ref} className={className}>
      <StageProvider value={store}>{children}</StageProvider>
    </div>
  );
}
