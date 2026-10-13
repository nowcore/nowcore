import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * NFR-4: an initial route's JS under 180 KB gzipped (docs/10-design-system.md).
 *
 * The storefront renders per request (it reads the catalogue from the API), so
 * there is no prerendered HTML to read. This boots the built API and the built
 * web app on spare ports, fetches every storefront route, and sums the scripts
 * each page's HTML tells a browser to fetch — the honest list, exactly what a
 * buyer downloads before the page is interactive.
 *
 * Needs Postgres up and seeded (pnpm infra:up && pnpm db:seed), as the API does.
 *
 * `noModule` scripts are excluded: legacy polyfills every module-capable
 * browser skips (they overstated the empty shell by 38.7 KB on 13 Oct 2026).
 * gzip at zlib's default, which is what a server sends.
 */
const BUDGET_BYTES = 180 * 1024;
const DIST = process.env.NEXT_DIST_DIR ?? '.next-build';
// Not 4190: it is on the Fetch spec's blocked-port list (ManageSieve) and
// undici refuses it with "bad port".
const API_PORT = 4180;
const WEB_PORT = 3180;
const ROUTES = ['/', '/shop', '/product/mediocre-by-design-tee', '/cart'];

if (!existsSync(join(DIST, 'BUILD_ID'))) {
  console.error(`No build at ${DIST}. Run \`nx build web\` first.`);
  process.exit(1);
}

const children = [];
const stop = () => children.forEach((c) => c.kill('SIGTERM'));
process.on('exit', stop);

function boot(cmd, args, opts, ready) {
  const child = spawn(cmd, args, {
    ...opts,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  let log = '';
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${cmd} did not start:\n${log}`)),
      30_000,
    );
    const onData = (d) => {
      log += d;
      if (ready.test(log)) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) =>
      reject(new Error(`${cmd} exited ${code}:\n${log}`)),
    );
  });
}

try {
  await boot(
    'node',
    ['dist/main.js'],
    { cwd: '../api', env: { ...process.env, PORT: String(API_PORT) } },
    /listening/,
  );
  await boot(
    'pnpm',
    ['exec', 'next', 'start', '-p', String(WEB_PORT)],
    {
      env: {
        ...process.env,
        NEXT_DIST_DIR: DIST,
        API_URL: `http://localhost:${API_PORT}`,
      },
    },
    /Ready/,
  );

  let worst = 0;
  for (const route of ROUTES) {
    const res = await fetch(`http://localhost:${WEB_PORT}${route}`);
    if (!res.ok) throw new Error(`${route} answered ${res.status}`);
    const tags = (await res.text()).match(/<script\b[^>]*>/g) ?? [];
    const scripts = [
      ...new Set(
        tags
          .filter((t) => !/\bnoModule\b/i.test(t))
          .map((t) => /src="(\/_next\/static\/[^"]+?\.js)"/.exec(t)?.[1])
          .filter(Boolean),
      ),
    ];
    const bytes = scripts.reduce(
      (total, url) =>
        total +
        gzipSync(readFileSync(join(DIST, url.replace('/_next/', '')))).length,
      0,
    );
    worst = Math.max(worst, bytes);
    console.log(
      `${route.padEnd(34)} ${(bytes / 1024).toFixed(1).padStart(7)} KB gzipped  ` +
        `${String(scripts.length).padStart(2)} files  (${Math.round((bytes / BUDGET_BYTES) * 100)}%)` +
        (bytes > BUDGET_BYTES ? '  OVER' : ''),
    );
  }
  console.log(
    `\nBudget ${BUDGET_BYTES / 1024} KB gzipped per initial route  [NFR-4]`,
  );
  stop();
  if (worst > BUDGET_BYTES) {
    console.error(
      `\nOver budget by ${((worst - BUDGET_BYTES) / 1024).toFixed(1)} KB.\n` +
        'The reference device is a mid-tier Android on Indian 4G: bytes here are\n' +
        'seconds there. Either the addition earns them and NFR-4 moves deliberately,\n' +
        'or it is loaded on demand instead.',
    );
    process.exit(1);
  }
  process.exit(0);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  stop();
  process.exit(1);
}
