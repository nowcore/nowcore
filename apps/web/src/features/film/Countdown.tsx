'use client';
import { useEffect, useState } from 'react';

/**
 * How far this device's clock is from the server's, in ms, measured once per
 * page from the Date header of a HEAD request (T-084). A phone set an hour
 * wrong would otherwise count down to the wrong moment. The page itself may be
 * cached, so the time it was rendered is no use; a live response's header is.
 * Second resolution, which is all a HH:MM:SS display needs.
 */
let skew: Promise<number> | undefined;
function serverSkew(): Promise<number> {
  skew ??= (async () => {
    const sent = Date.now();
    const res = await fetch('/icon.svg', {
      method: 'HEAD',
      cache: 'no-store',
    });
    const back = Date.now();
    const server = Date.parse(res.headers.get('date') ?? '');
    // The header truncates to the second; +500 ms centres it.
    return Number.isNaN(server) ? 0 : server + 500 - (sent + back) / 2;
  })().catch(() => 0);
  return skew;
}

/**
 * HH:MM:SS to the drop's close. The server renders the value at request time
 * so the first paint is right; the client ticks it on the server's clock.
 * Display only — the API refuses a cart or order after closesAt regardless.
 */
export function Countdown({
  closesAt,
  className,
}: {
  closesAt: string;
  className?: string;
}) {
  const end = Date.parse(closesAt);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let live = true;
    void serverSkew().then((s) => live && setOffset(s));
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);
  const left = Math.max(0, end - (now + offset));
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
