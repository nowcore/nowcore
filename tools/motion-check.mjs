/**
 * The measured half of the motion-check skill (.claude/skills/motion-check).
 *
 *   node tools/motion-check.mjs [url]        default http://localhost:3100/
 *
 * Serves nothing itself: point it at a *production* build (`next start`),
 * never `next dev` — HMR and unminified React make the numbers meaningless.
 *
 * For each tier it loads the page on a throttled phone profile, scrolls the
 * first stage end to end, and records:
 *   - frame times from requestAnimationFrame while scrolling → fps at p95
 *   - LCP, CLS (PerformanceObserver, buffered)
 *   - long tasks over 50 ms during the scroll
 *
 * Simulation, not a device: 4× CPU slowdown and a Fast-4G-shaped network on
 * a laptop approximate a mid-tier Android; they do not replace one. The gate
 * in docs/06 says "mid-tier Android" and still needs a real one.
 */
import { chromium } from '@playwright/test';

const URL_BASE = process.argv[2] ?? 'http://localhost:3100/';
const BUDGET = { fps: 55, lcp: 2500, cls: 0.1, longTasks: 0 };

const PROFILE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};
// ~Chrome's "Fast 4G" preset, in bytes per second.
const NETWORK = {
  offline: false,
  latency: 60,
  downloadThroughput: (9 * 1024 * 1024) / 8,
  uploadThroughput: (1.5 * 1024 * 1024) / 8,
};

async function measure(browser, tier) {
  const context = await browser.newContext({
    ...PROFILE,
    reducedMotion: tier === 'static' ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', NETWORK);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  await page.addInitScript(() => {
    window.__nc = { lcp: 0, cls: 0, longTasks: [] };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__nc.lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        if (!e.hadRecentInput) window.__nc.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__nc.longTasks.push(e.duration);
    }).observe({ type: 'longtask', buffered: true });
  });

  const url = new URL(URL_BASE);
  if (tier !== 'static') url.searchParams.set('tier', tier);
  await page.goto(url.href, { waitUntil: 'load' });
  // Let frames decode and the tier settle, as a buyer reading the headline would.
  await page.waitForTimeout(2500);
  const lcp = await page.evaluate(() => window.__nc.lcp);
  const before = await page.evaluate(() => window.__nc.longTasks.length);

  // Scroll the first stage end to end in wheel steps, recording frame times.
  const frames = await page.evaluate(async () => {
    const stage = document.querySelector('[data-stage]');
    const travel = Math.max(0, stage.offsetHeight - window.innerHeight);
    const deltas = [];
    let last = performance.now();
    let running = true;
    const tick = (t) => {
      deltas.push(t - last);
      last = t;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const steps = 90;
    for (let i = 1; i <= steps; i++) {
      window.scrollTo(0, (travel * i) / steps);
      await new Promise((r) => setTimeout(r, 1000 / 30));
    }
    await new Promise((r) => setTimeout(r, 300));
    running = false;
    return deltas.slice(2);
  });

  const after = await page.evaluate(() => ({
    cls: window.__nc.cls,
    longTasks: window.__nc.longTasks,
  }));
  const painted = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    return c ? c.style.opacity === '1' : null;
  });
  const frameBytes = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((r) => r.name.includes('/frames/'))
      .reduce((t, r) => t + r.transferSize, 0),
  );
  await context.close();

  const sorted = [...frames].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const scrollLong = after.longTasks.slice(before).filter((d) => d > 50);
  return {
    tier,
    fpsP95: p95 ? 1000 / p95 : 0,
    lcp,
    cls: after.cls,
    longTasks: scrollLong.length,
    worstLongTask: Math.max(0, ...scrollLong),
    canvas: painted,
    frameKB: frameBytes / 1024,
  };
}

const browser = await chromium.launch({ args: ['--enable-gpu-rasterization'] });
const rows = [];
for (const tier of ['full', 'reduced', 'static'])
  rows.push(await measure(browser, tier));
await browser.close();

let failed = false;
console.log(`motion-check  ${URL_BASE}  390×844@2x · 4× CPU · Fast 4G\n`);
console.log(
  'tier      fps p95   LCP      CLS     long tasks   canvas   frames',
);
for (const r of rows) {
  const bad = [];
  // The static tier has nothing to animate; frame rate is not its job.
  if (r.tier !== 'static' && r.fpsP95 < BUDGET.fps) bad.push('fps');
  if (r.lcp > BUDGET.lcp) bad.push('LCP');
  if (r.cls > BUDGET.cls) bad.push('CLS');
  if (r.longTasks > BUDGET.longTasks) bad.push('long tasks');
  if (bad.length) failed = true;
  console.log(
    `${r.tier.padEnd(9)} ${r.fpsP95.toFixed(0).padStart(4)}fps  ${(r.lcp / 1000).toFixed(2)}s   ${r.cls.toFixed(3)}   ` +
      `${String(r.longTasks).padStart(2)}${r.longTasks ? ` (max ${r.worstLongTask.toFixed(0)}ms)` : '          '}   ` +
      `${String(r.canvas).padEnd(7)}  ${r.frameKB.toFixed(0)} KB${bad.length ? '   FAIL: ' + bad.join(', ') : ''}`,
  );
}
console.log(
  `\nBudgets: ≥${BUDGET.fps}fps p95 · LCP <${BUDGET.lcp / 1000}s · CLS <${BUDGET.cls} · no long tasks while scrolling`,
);
process.exit(failed ? 1 : 0);
