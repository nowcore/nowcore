'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * The order board's "live" (T-069): re-render from the server every 10 s.
 * Supabase Realtime was the plan, and waits on the hosted project; polling a
 * server component is the honest substitute and needs no socket at all.
 * Paused while the tab is hidden.
 */
export function LiveRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-smoke">
      <span className="size-[5px] rounded-full bg-accent" aria-hidden="true" />
      Live · {seconds}s
    </span>
  );
}
