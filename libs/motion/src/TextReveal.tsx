'use client';
import {
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from 'react';
import { useTier } from './context.js';

/**
 * Per-line mask-up with a blur-out, 40 ms apart (docs/10). Each line slides up
 * out of its own clipped box. The text is in the DOM from the first byte —
 * this is decoration on content that is already there, never content gated
 * on JavaScript. Static tier: no transform at all.
 */
export function TextReveal({
  lines,
  as: Tag = 'div',
  className,
  lineClassNames = [],
}: {
  lines: ReactNode[];
  as?: ElementType;
  className?: string;
  /** Per-line classes — how the two-line move gets its serif second line. */
  lineClassNames?: (string | undefined)[];
}) {
  const tier = useTier();
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (tier === 'static' || !ref.current) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [tier]);

  const animate = tier !== 'static';
  return (
    <Tag
      ref={ref}
      className={className}
      data-reveal={animate ? (shown ? 'in' : 'out') : 'static'}
    >
      {lines.map((line, i) => (
        <span
          key={i}
          className={['nc-reveal-line', lineClassNames[i]]
            .filter(Boolean)
            .join(' ')}
        >
          <span
            className="nc-reveal-inner"
            style={animate ? { transitionDelay: `${i * 40}ms` } : undefined}
          >
            {line}
          </span>
        </span>
      ))}
    </Tag>
  );
}
