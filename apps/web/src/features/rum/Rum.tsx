'use client';
import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import { useEffect, useRef } from 'react';
import { useTier } from '@nowcore/motion';

/** "/product/mediocre-by-design-tee" → "/product/[slug]": routes, never URLs (a token rides on /order). */
function routeOf(path: string): string {
  if (path.startsWith('/product/')) return '/product/[slug]';
  if (path.startsWith('/order/')) return '/order/[reference]';
  return path.split('?')[0] ?? '/';
}

/**
 * Field performance (T-094): Core Web Vitals from Next, plus the one number
 * the lab cannot give — the 95th-percentile frame time while a real visitor
 * scrolls the film on their own phone (NFR-2). One beacon per page view, sent
 * when the page is hidden or left. Frames are timed only while scrolling, so
 * an idle tab costs nothing.
 */
export function Rum() {
  // A ref, not a dependency: the tier resolves after hydration (static → full),
  // and that must not end the page view (found 15 Oct: it sent a half beacon).
  const current = useTier();
  const tier = useRef(current);
  tier.current = current;
  const path = usePathname();
  const vitals = useRef<Record<string, number>>({});
  const frames = useRef<number[]>([]);

  useReportWebVitals((m) => {
    if (['LCP', 'INP', 'CLS', 'FCP', 'TTFB'].includes(m.name))
      vitals.current[m.name] = m.value;
  });

  useEffect(() => {
    let raf = 0;
    let last = 0;
    let lastScroll = 0;
    const tick = (t: number) => {
      if (last) frames.current.length < 5000 && frames.current.push(t - last);
      last = t;
      raf =
        performance.now() - lastScroll < 200 ? requestAnimationFrame(tick) : 0;
      if (!raf) last = 0;
    };
    // LCP is only finalised when the page hides, and whether the vitals
    // library or this beacon hears "hidden" first is listener order — LCP went
    // missing from every beacon (15 Oct). Keep our own last LCP as the fallback.
    let lcp: number | undefined;
    const lcpObserver =
      typeof PerformanceObserver !== 'undefined' &&
      PerformanceObserver.supportedEntryTypes?.includes(
        'largest-contentful-paint',
      )
        ? new PerformanceObserver((list) => {
            const e = list.getEntries().at(-1);
            if (e) lcp = e.startTime;
          })
        : null;
    lcpObserver?.observe({ type: 'largest-contentful-paint', buffered: true });

    const onScroll = () => {
      lastScroll = performance.now();
      if (!raf) raf = requestAnimationFrame(tick);
    };

    let sent = false;
    const flush = () => {
      if (sent) return;
      if (vitals.current.LCP === undefined && lcp !== undefined)
        vitals.current.LCP = lcp;
      const metrics = Object.entries(vitals.current).map(([name, value]) => ({
        name,
        value,
      }));
      const ft = [...frames.current].sort((a, b) => a - b);
      // Fewer than 30 frames is a flick, not a scroll; it says nothing about NFR-2.
      if (ft.length >= 30)
        metrics.push({
          name: 'SCROLL_FT95',
          value: ft[Math.floor(ft.length * 0.95)] ?? 0,
        });
      if (!metrics.length) return;
      sent = true;
      const nav = navigator as Navigator & {
        deviceMemory?: number;
        connection?: { effectiveType?: string };
        userAgentData?: { mobile?: boolean };
      };
      const body = JSON.stringify({
        route: routeOf(path),
        tier: tier.current,
        ...(nav.hardwareConcurrency ? { cores: nav.hardwareConcurrency } : {}),
        ...(nav.deviceMemory ? { memory: nav.deviceMemory } : {}),
        ...(nav.connection?.effectiveType
          ? { net: nav.connection.effectiveType }
          : {}),
        mobile:
          nav.userAgentData?.mobile ?? matchMedia('(pointer: coarse)').matches,
        metrics: metrics.map((m) => ({
          ...m,
          value: Math.round(m.value * 1000) / 1000,
        })),
      });
      navigator.sendBeacon?.(
        '/api/rum',
        new Blob([body], { type: 'application/json' }),
      );
    };
    const onHide = () => document.visibilityState === 'hidden' && flush();

    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      // A client-side navigation ends this page view: report it, start the next clean.
      flush();
      vitals.current = {};
      frames.current = [];
      cancelAnimationFrame(raf);
      lcpObserver?.disconnect();
      removeEventListener('scroll', onScroll);
      removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [path]);

  return null;
}
