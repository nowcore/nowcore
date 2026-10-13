'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { useStageStore, useTier } from './context.js';

/**
 * A row of panels that slides sideways as the enclosing ScrollStage scrolls
 * down — the shop's rail (docs/10, pages). The transform is written straight
 * to the element from the store, never through React.
 *
 * Static tier, or no stage: a plain horizontally scrollable row, reachable by
 * keyboard and swipe, so the rail never depends on motion to be usable.
 */
export function HorizontalRail({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  const tier = useTier();
  const store = useStageStore();
  const track = useRef<HTMLDivElement>(null);
  const moving = tier !== 'static';

  useEffect(() => {
    const el = track.current;
    if (!el || !moving) return;
    const apply = () => {
      const viewport = el.parentElement?.clientWidth ?? window.innerWidth;
      const distance = Math.max(0, el.scrollWidth - viewport);
      el.style.transform = `translate3d(${-store.get() * distance}px, 0, 0)`;
    };
    apply();
    window.addEventListener('resize', apply);
    const off = store.subscribe(apply);
    return () => {
      off();
      window.removeEventListener('resize', apply);
    };
  }, [moving, store]);

  return (
    <div
      role="region"
      aria-label={label}
      className={className}
      style={{ overflowX: moving ? 'hidden' : 'auto' }}
      tabIndex={moving ? undefined : 0}
    >
      <div
        ref={track}
        style={{
          display: 'flex',
          width: 'max-content',
          willChange: moving ? 'transform' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
