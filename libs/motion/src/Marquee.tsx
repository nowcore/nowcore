import type { ReactNode } from 'react';

/**
 * A seamless ticker. Pure CSS: the content is rendered twice and the track
 * slides by exactly half. It pauses on hover and stops entirely under
 * reduced motion (motion.css). The duplicate is hidden from assistive tech so
 * a screen reader hears the list once.
 */
export function Marquee({
  children,
  seconds = 40,
  label,
}: {
  children: ReactNode;
  seconds?: number;
  label: string;
}) {
  return (
    <div className="nc-marquee" role="region" aria-label={label}>
      <div
        className="nc-marquee-track"
        style={{ animationDuration: `${seconds}s` }}
      >
        <div className="nc-marquee-set">{children}</div>
        <div className="nc-marquee-set" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
