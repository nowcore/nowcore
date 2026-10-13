'use client';
import type { ReactNode } from 'react';
import { useStageStep, useTier } from './context.js';
import { segment } from './progress.js';

/**
 * Fades and lifts its children across a slice of the enclosing stage, so one
 * pinned chapter can play several beats in order. Quantised to 24 steps: the
 * component re-renders at most 24 times per scroll, never per frame.
 *
 * `out` makes it leave again — a line that arrives at 20% and is gone by 70%.
 * Static tier: always fully visible, nothing moves.
 */
export function Beat({
  children,
  from,
  to,
  out,
  lift = 24,
  className,
}: {
  children: ReactNode;
  from: number;
  to: number;
  /** Optional [start, end] over which it fades back out. */
  out?: readonly [number, number];
  lift?: number;
  className?: string;
}) {
  const tier = useTier();
  const step = useStageStep(24) / 24;
  if (tier === 'static') return <div className={className}>{children}</div>;
  const inP = segment(step, from, to);
  const outP = out ? segment(step, out[0], out[1]) : 0;
  const v = Math.max(0, inP - outP);
  return (
    <div
      className={className}
      style={{
        opacity: v,
        transform: `translate3d(0, ${(1 - inP) * lift - outP * lift}px, 0)`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
}
