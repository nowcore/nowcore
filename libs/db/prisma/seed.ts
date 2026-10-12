/**
 * Local seed (T-019): one live drop, one archived, enough to browse.
 *
 * Idempotent — every write is an upsert on a natural key — so it can be run
 * after every `migrate` without growing duplicates.
 *
 * Accent colours are written here as data, not styling: a drop's accent is a
 * row in the database, which is the whole point of `--drop-accent`.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { ChapterKey, makeSku, rupees, type Size } from '@nowcore/shared';

const url =
  process.env['DATABASE_URL'] ??
  'postgresql://nowcore:nowcore@localhost:5433/nowcore';
const db = new PrismaClient({ adapter: new PrismaPg(url) });

const COLOURWAYS = [
  { code: 'BLK', name: 'Void black', hex: '#15171B' },
  { code: 'BONE', name: 'Bone', hex: '#E8E5DE' },
  { code: 'ASH', name: 'Ash grey', hex: '#4A4F57' },
  { code: 'MOSS', name: 'Deep moss', hex: '#2C3A2E' },
];
const SIZES: Size[] = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

const COPY: Record<string, [string, string, string]> = {
  'the-signal': ['Drop 014 — Mediocre By Design', 'Wear the', 'moment.'],
  'whats-now': ["01 / What's now", 'The internet,', 'right now.'],
  'the-drop': ['02 / The drop', 'Mediocre', 'by design.'],
  'the-archive': ['03 / The archive', 'Here,', 'then gone.'],
  'the-making': ['04 / The making', 'Spotted at nine.', 'Shipping by six.'],
  'the-wall': ['05 / The wall', 'Worn by', 'the timeline.'],
  'take-it': ['06 / Take it', 'Never miss', 'a drop.'],
};
const chapters = ChapterKey.options.map((key) => {
  const [kicker, lineOne, lineTwo] = COPY[key] as [string, string, string];
  return { key, kicker, lineOne, lineTwo };
});

async function drop(input: {
  number: number;
  slug: string;
  title: string;
  accent: string;
  status: 'LIVE' | 'ARCHIVED';
  opensAt: Date;
  closesAt: Date;
  product: { slug: string; title: string; description: string };
  soldOut: Size[];
}) {
  const d = await db.drop.upsert({
    where: { number: input.number },
    update: {
      status: input.status,
      opensAt: input.opensAt,
      closesAt: input.closesAt,
    },
    create: {
      number: input.number,
      slug: input.slug,
      title: input.title,
      accentColor: input.accent,
      status: input.status,
      opensAt: input.opensAt,
      closesAt: input.closesAt,
      editionSize: 500,
      chapters,
    },
  });
  const p = await db.product.upsert({
    where: { slug: input.product.slug },
    update: {},
    create: { ...input.product, dropId: d.id, basePaise: rupees(799) },
  });
  for (const c of COLOURWAYS) {
    for (const size of SIZES) {
      const sku = makeSku({
        drop: input.number,
        garment: 'TEE',
        color: c.code,
        size,
      });
      await db.variant.upsert({
        where: { sku },
        update: { soldOut: input.soldOut.includes(size) },
        create: {
          productId: p.id,
          size,
          colorName: c.name,
          colorHex: c.hex,
          sku,
          pricePaise: rupees(
            size.startsWith('2') || size.startsWith('3') ? 849 : 799,
          ),
          soldOut: input.soldOut.includes(size),
        },
      });
    }
  }
  return d;
}

const now = Date.now();
const HOUR = 3_600_000;

await drop({
  number: 14,
  slug: 'mediocre-by-design',
  title: 'Mediocre By Design',
  accent: '#D7FF3E',
  status: 'LIVE',
  opensAt: new Date(now - 1 * HOUR),
  closesAt: new Date(now + 71 * HOUR),
  product: {
    slug: 'mediocre-by-design-tee',
    title: 'Mediocre By Design',
    description:
      '200gsm combed cotton, bio-washed. Direct-to-film print that will not crack. Printed in India the day you order it.',
  },
  soldOut: ['XS', '2XL'],
});

await drop({
  number: 13,
  slug: 'touch-grass-protocol',
  title: 'Touch Grass Protocol',
  accent: '#FF6B1A',
  status: 'ARCHIVED',
  opensAt: new Date(now - 18 * 24 * HOUR),
  closesAt: new Date(now - 15 * 24 * HOUR),
  product: {
    slug: 'touch-grass-protocol-tee',
    title: 'Touch Grass Protocol',
    description: 'Archived. Never restocked.',
  },
  soldOut: SIZES,
});

const counts = {
  drops: await db.drop.count(),
  products: await db.product.count(),
  variants: await db.variant.count(),
};
console.log('seeded', counts);
await db.$disconnect();
