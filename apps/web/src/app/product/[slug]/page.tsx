import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ScrollTrack } from '@nowcore/motion';
import { dropLabel, formatInr } from '@nowcore/shared';
import { NotFound, productPage } from '../../../lib/api';
import { currentCart } from '../../../features/cart/cart';
import { FilmChrome } from '../../../features/film/Chrome';
import { ProductStage } from '../../../features/product/ProductStage';

export const dynamic = 'force-dynamic';

async function load(slug: string) {
  try {
    return await productPage(slug);
  } catch (e) {
    if (e instanceof NotFound) notFound();
    throw e;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { product, drop } = await load((await params).slug);
  return {
    title: `${product.title} — ${dropLabel(drop.number)} · NOWCORE`,
    description: product.description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      // Replaces the layout's openGraph rather than merging with it, so it repeats these.
      siteName: 'NOWCORE',
      locale: 'en_IN',
      type: 'website',
      title: product.title,
      description: product.description,
    },
  };
}

const SPECS = [
  [
    'Fabric',
    '200gsm combed cotton, bio-washed for a soft hand that survives Indian summers and a monthly wash cycle.',
  ],
  [
    'Print',
    'Direct-to-film at 300dpi. Flexible, matte, and tested to 40 washes without cracking at the fold.',
  ],
  [
    'Fit',
    'Regular, slightly boxy. Shoulder drop 2cm. Model is 180cm wearing L.',
  ],
  [
    'Care',
    'Cold machine wash inside out. Tumble dry low. Do not iron directly on the print.',
  ],
] as const;

/** The product page (T-047): sticky turntable left, specs right, buy bar fixed. */
export default async function ProductPageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ drop, product }, cart] = await Promise.all([
    load(slug),
    currentCart(),
  ]);
  const open = drop.status === 'LIVE';
  // The two-line move on a product title: the last two words go serif.
  const words = product.title.split(' ');
  const lead =
    words.length > 2
      ? words.slice(0, -2).join(' ')
      : words.slice(0, 1).join(' ');
  const tail = `${(words.length > 2 ? words.slice(-2) : words.slice(1)).join(' ').toLowerCase()}.`;

  // Product structured data (T-093): what a search result can say about it.
  const sizes = product.colourways.flatMap((c) => c.sizes);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    brand: { '@type': 'Brand', name: 'NOWCORE' },
    sku: sizes[0]?.sku,
    image: product.colourways
      .map((c) => c.frames?.still)
      .filter((u): u is string => !!u),
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: (Math.min(...sizes.map((z) => z.pricePaise)) / 100).toFixed(2),
      highPrice: (Math.max(...sizes.map((z) => z.pricePaise)) / 100).toFixed(2),
      offerCount: sizes.length,
      availability:
        open && sizes.some((z) => !z.soldOut)
          ? 'https://schema.org/InStock'
          : 'https://schema.org/SoldOut',
    },
  };

  return (
    <main className="bg-void pb-40 font-sans text-paper">
      <script
        type="application/ld+json"
        // Escaped: a product title is operator input, and "</script>" in it must not end the tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <FilmChrome
        drop={drop}
        buyHref={`/product/${product.slug}`}
        current="none"
        cartCount={cart?.count ?? 0}
      />
      <ScrollTrack className="mx-auto max-w-[1320px] px-5 pt-24 md:px-10 md:pt-0">
        <ProductStage
          product={product}
          open={open}
          // Keyed because React's dev build flags server-made elements handed to
          // a client component as props ("unique key", 15 Oct 2026). Dev only.
          header={
            <div key="header" className="flex flex-col gap-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-smoke">
                {dropLabel(drop.number)} · {drop.claimed} of{' '}
                {drop.editionSize ?? '∞'} claimed
              </p>
              <h1 className="leading-[0.96]">
                <span className="block text-[clamp(2.75rem,5vw,3.5rem)] font-medium tracking-[-0.042em]">
                  {lead}
                </span>
                <span className="-ml-0.5 block font-serif text-[clamp(3rem,5.5vw,3.75rem)] italic">
                  {tail}
                </span>
              </h1>
              <p className="font-mono text-3xl text-paper">
                {formatInr(product.fromPaise)}{' '}
                <span className="text-xs tracking-[0.1em] text-ghost">
                  incl. GST · free shipping over ₹999
                </span>
              </p>
              <p className="max-w-[460px] leading-relaxed text-smoke">
                {product.description}
              </p>
              {!open && (
                <p className="rounded border border-steel px-4 py-3 text-sm text-smoke">
                  This drop has closed. Nothing is restocked —{' '}
                  <a href="/#take-it" className="underline">
                    join the waitlist
                  </a>{' '}
                  for the next one.
                </p>
              )}
            </div>
          }
          details={
            <dl key="details" className="border-t border-steel">
              {SPECS.map(([k, v]) => (
                <div
                  key={k}
                  className="flex gap-6 border-b border-steel/60 py-6 md:min-h-[30svh] md:items-start"
                >
                  <dt className="w-24 shrink-0 pt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ghost">
                    {k}
                  </dt>
                  <dd className="text-[15px] leading-relaxed text-paper-dim">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          }
        />
      </ScrollTrack>
    </main>
  );
}
