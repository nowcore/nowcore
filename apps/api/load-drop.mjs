/**
 * T-096 — a drop opening with N concurrent buyers.
 *
 *   pnpm exec nx run api:load                 500 buyers, edition 100
 *   BUYERS=1000 EDITION=50 pnpm exec nx run api:load
 *
 * Boots the built API on its own port (fake payments, its own queue prefix,
 * rate limits on), makes a throwaway live drop with an edition cap, then
 * releases every buyer at once: cart → line → order → pay → verify. Each
 * buyer has its own IP, forwarded the way the storefront does it.
 *
 * Fails (exit 1) on any 5xx, or if more pieces were paid for than the edition
 * holds. Prints latency per step. The drop and its orders are removed after.
 */
import { spawn } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@nowcore/db';
import { BLANKS } from '@nowcore/shared';
import { SIGNAL } from '@nowcore/shared/color';

const BUYERS = Number(process.env.BUYERS ?? 500);
const EDITION = Number(process.env.EDITION ?? 100);
const PORT = 4180;
const API = `http://127.0.0.1:${PORT}`;
const BFF_SECRET = 'load-test-bff-secret-000000';
const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://nowcore:nowcore@localhost:5433/nowcore';

const BLACK = BLANKS.find((b) => b.code === 'blk');
const db = new PrismaClient({ adapter: new PrismaPg(DATABASE_URL) });
const number = 500 + Math.floor(Math.random() * 99); // clear of the test suites' ranges
const tag = `NC-${number}-`;

// ------------------------------------------------------------------ the API

const api = spawn('node', ['dist/main.js'], {
  env: {
    ...process.env,
    PORT: String(PORT),
    PAYMENTS: 'fake',
    RECONCILE: 'off',
    DROP_CLOCK: 'off',
    RATE_LIMIT: 'on',
    BFF_SECRET,
    QUEUE_PREFIX: `load-${number}`,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let apiLog = '';
api.stdout.on('data', (d) => (apiLog += d));
api.stderr.on('data', (d) => (apiLog += d));
process.on('exit', () => api.kill('SIGTERM'));

async function ready() {
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(`${API}/drops/live`)).status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`the API did not start:\n${apiLog}`);
}

// ------------------------------------------------------------------ the drop

async function makeDrop() {
  return db.drop.create({
    data: {
      number,
      slug: `load-${number}`,
      title: 'Load Test',
      accentColor: SIGNAL,
      status: 'LIVE',
      // Opened "long ago", so the storefront never shows it as the live drop.
      opensAt: new Date('2020-01-01'),
      closesAt: new Date(Date.now() + 3_600_000),
      editionSize: EDITION,
      chapters: [],
      products: {
        create: {
          slug: `load-${number}-tee`,
          title: 'Load Tee',
          description: 'load test',
          basePaise: 79900,
          variants: {
            create: ['M', 'L'].map((size) => ({
              size,
              colorName: BLACK.name,
              colorHex: BLACK.hex,
              sku: `${tag}TEE-BLK-${size}`,
              pricePaise: 79900,
              podVariantId: `sbx_${tag}${size}`,
            })),
          },
        },
      },
    },
  });
}

async function cleanup(dropId) {
  const orders = await db.order.findMany({
    where: { items: { some: { skuSnap: { startsWith: tag } } } },
    select: { id: true, cartId: true },
  });
  const ids = orders.map((o) => o.id);
  await db.orderEvent.deleteMany({ where: { orderId: { in: ids } } });
  await db.orderItem.deleteMany({ where: { orderId: { in: ids } } });
  await db.order.deleteMany({ where: { id: { in: ids } } });
  const variants = await db.variant.findMany({
    where: { sku: { startsWith: tag } },
  });
  const items = await db.cartItem.findMany({
    where: { variantId: { in: variants.map((v) => v.id) } },
    select: { cartId: true },
  });
  await db.cartItem.deleteMany({
    where: { variantId: { in: variants.map((v) => v.id) } },
  });
  await db.cart.deleteMany({
    where: { id: { in: [...new Set(items.map((i) => i.cartId))] } },
  });
  await db.variant.deleteMany({ where: { sku: { startsWith: tag } } });
  await db.product.deleteMany({ where: { dropId } });
  await db.drop.delete({ where: { id: dropId } });
}

// ------------------------------------------------------------------ a buyer

const timings = { cart: [], line: [], order: [], pay: [], verify: [] };
const codes = {};

async function step(name, ip, method, path, body) {
  const t = performance.now();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'x-client-ip': ip,
      'x-bff-secret': BFF_SECRET,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  timings[name].push(performance.now() - t);
  const key = `${name} ${res.status}`;
  codes[key] = (codes[key] ?? 0) + 1;
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function buyer(i, go) {
  const ip = `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`;
  await go;
  const cart = await step('cart', ip, 'POST', '/carts');
  if (!cart.ok) return;
  const line = await step('line', ip, 'PUT', `/carts/${cart.json.id}/items`, {
    sku: `${tag}TEE-BLK-${i % 2 ? 'M' : 'L'}`,
    quantity: 1,
  });
  if (!line.ok) return;
  const order = await step('order', ip, 'POST', '/orders', {
    cartId: cart.json.id,
    email: `buyer${i}@load.test`,
    phone: `98${String(i).padStart(8, '0')}`,
    address: {
      name: 'Load Buyer',
      line1: '1 Test Street',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
    },
    pay: 'PREPAID',
  });
  if (!order.ok) return;
  const { providerOrderId } = order.json.payment;
  const paid = await step(
    'pay',
    ip,
    'POST',
    `/dev/fake-payments/${providerOrderId}/pay`,
  );
  if (!paid.ok) return;
  await step('verify', ip, 'POST', `/orders/${order.json.reference}/verify`, {
    providerOrderId,
    paymentId: paid.json.paymentId,
    signature: paid.json.signature,
  });
}

// ------------------------------------------------------------------ run

const pct = (xs, p) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const ms = (n) => `${Math.round(n)}ms`.padStart(7);

let drop;
let failed = false;
try {
  await ready();
  drop = await makeDrop();
  let release;
  const go = new Promise((r) => (release = r));
  const all = Array.from({ length: BUYERS }, (_, i) => buyer(i, go));
  const started = performance.now();
  release();
  await Promise.all(all);
  const wall = performance.now() - started;

  const paid =
    (
      await db.orderItem.aggregate({
        _sum: { quantity: true },
        where: {
          skuSnap: { startsWith: tag },
          order: { status: { notIn: ['PENDING', 'CANCELLED'] } },
        },
      })
    )._sum.quantity ?? 0;

  console.log(
    `\nload-drop  ${BUYERS} buyers · edition ${EDITION} · ${(wall / 1000).toFixed(1)} s wall\n`,
  );
  console.log('step      count     p50     p95     p99     max');
  for (const [name, xs] of Object.entries(timings))
    console.log(
      `${name.padEnd(8)} ${String(xs.length).padStart(6)} ${ms(pct(xs, 50))} ${ms(pct(xs, 95))} ${ms(pct(xs, 99))} ${ms(Math.max(0, ...xs))}`,
    );
  console.log('\nresponses');
  for (const [k, n] of Object.entries(codes).sort())
    console.log(`  ${k.padEnd(14)} ${n}`);
  console.log(`\npaid pieces ${paid} / edition ${EDITION}`);

  const errors = Object.entries(codes).filter(([k]) => / 5\d\d$/.test(k));
  if (paid > EDITION) {
    console.log(`FAIL oversold by ${paid - EDITION}`);
    failed = true;
  }
  if (errors.length) {
    console.log(
      `FAIL server errors: ${errors.map(([k, n]) => `${k} ×${n}`).join(', ')}`,
    );
    failed = true;
  }
  if (!failed) console.log('PASS');
} finally {
  if (drop) await cleanup(drop.id);
  await db.$disconnect();
  api.kill('SIGTERM');
}
process.exit(failed ? 1 : 0);
