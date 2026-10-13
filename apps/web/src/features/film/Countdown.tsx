'use client';
import { useEffect, useState } from 'react';

/**
 * HH:MM:SS to the drop's close. The server renders the value at request time
 * so the first paint is right; the client ticks it. Server-authoritative
 * closing (the drop actually archiving) is T-082 — this is display only.
 */
export function Countdown({
  closesAt,
  className,
}: {
  closesAt: string;
  className?: string;
}) {
  const end = Date.parse(closesAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, end - now);
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    <time dateTime={closesAt} className={className} suppressHydrationWarning>
      {left === 0 ? 'Closed' : `${p(h)}:${p(m)}:${p(s)}`}
    </time>
  );
}
