'use client';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { StageProvider, useTier } from './context.js';
import { stageProgress } from './progress.js';
import { createProgressStore } from './store.js';

/**
 * A pinned chapter (docs/10 motion grammar). The section is `length` screens
 * tall; its stage is `position: sticky; top: 0` and stays put while the
 * section scrolls past, emitting progress 0 → 1 to everything inside.
 *
 * This is the technique morphowater.com uses (`.flow-stage`, sticky, top 0),
 * and it is why there is no GSAP here: CSS does the pinning, and progress is
 * one division per animation frame.
 *
 * In the static tier the section collapses to one screen and nothing pins:
 * reduced motion means the page scrolls like a page.
 */
export function ScrollStage({
  children,
  length = 3,
  id,
  label,
  className,
}: {
  children: ReactNode;
  /** Section height in viewport heights. 3 = the scrub lasts two screens. */
  length?: number;
  id?: string;
  /** Accessible name for the chapter. */
  label?: string;
  className?: string;
}) {
  const tier = useTier();
  const section = useRef<HTMLElement>(null);
  const [store] = useState(() => createProgressStore(0));
  const pinned = tier !== 'static';

  useEffect(() => {
    const el = section.current;
    if (!el || !pinned) {
      store.set(1);
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      store.set(stageProgress(rect.top, rect.height, window.innerHeight));
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
  }, [pinned, store]);

  const sectionStyle: CSSProperties = {
    position: 'relative',
    height: pinned ? `${length * 100}svh` : 'auto',
  };
  const stageStyle: CSSProperties = pinned
    ? { position: 'sticky', top: 0, height: '100svh', overflow: 'hidden' }
    : { position: 'relative', minHeight: '100svh' };

  return (
    <section
      ref={section}
      id={id}
      aria-label={label}
      className={className}
      style={sectionStyle}
      data-stage
    >
      <div style={stageStyle} data-stage-pin={pinned ? 'sticky' : 'none'}>
        <StageProvider value={store}>{children}</StageProvider>
      </div>
    </section>
  );
}
