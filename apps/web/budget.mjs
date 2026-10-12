import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * NFR-4: an initial route's JS under 180 KB gzipped (docs/10-design-system.md).
 *
 * Measured from the prerendered HTML — the list of scripts a browser is told
 * to fetch before the page is interactive. No server, nothing flaky in CI.
 * Every prerendered route is checked: a buyer arrives on a product link as
 * often as on the homepage. gzip at zlib's default, which is what a server
 * sends; brotli would flatter the number.
 *
 * Frame sequences are not JS and are budgeted separately by the render job.
 *
 * `noModule` scripts are excluded: they are the legacy-browser polyfills, and
 * every browser that understands modules — every phone a buyer will use —
 * skips them. Counting them overstated the empty shell by 38.7 KB (91% of the
 * budget instead of 69%) on 13 Oct 2026.
 */
const BUDGET_BYTES = 180 * 1024;
const DIST = process.env.NEXT_DIST_DIR ?? '.next-build';
const APP = join(DIST, 'server/app');

if (!existsSync(APP)) {
  console.error(`No build at ${APP}. Run \`nx build web\` first.`);
  process.exit(1);
}

function routes(dir = APP, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return routes(path, `${prefix}/${entry.name}`);
    if (!entry.name.endsWith('.html')) return [];
    const name = entry.name.replace(/\.html$/, '');
    if (name.startsWith('_')) return [];
    return [[`${prefix}/${name === 'index' ? '' : name}`, path]];
  });
}

const found = routes();
if (found.length === 0) {
  console.error(`No prerendered routes under ${APP}.`);
  process.exit(1);
}

let worst = 0;
for (const [route, html] of found.sort()) {
  const tags = readFileSync(html, 'utf8').match(/<script\b[^>]*>/g) ?? [];
  const scripts = [
    ...new Set(
      tags
        .filter((tag) => !/\bnoModule\b/i.test(tag))
        .map((tag) => /src="(\/_next\/static\/[^"]+?\.js)"/.exec(tag)?.[1])
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
  const percent = Math.round((bytes / BUDGET_BYTES) * 100);
  console.log(
    `${route.padEnd(18)} ${(bytes / 1024).toFixed(1).padStart(7)} KB gzipped  ` +
      `${String(scripts.length).padStart(2)} files  (${percent}%)${bytes > BUDGET_BYTES ? '  OVER' : ''}`,
  );
}

console.log(
  `\nBudget ${BUDGET_BYTES / 1024} KB gzipped per initial route  [NFR-4]`,
);

if (worst > BUDGET_BYTES) {
  console.error(
    `\nOver budget by ${((worst - BUDGET_BYTES) / 1024).toFixed(1)} KB.\n` +
      'The reference device is a mid-tier Android on Indian 4G: bytes here are\n' +
      'seconds there. Either the addition earns them and NFR-4 moves deliberately,\n' +
      'or it is loaded on demand instead.',
  );
  process.exit(1);
}
