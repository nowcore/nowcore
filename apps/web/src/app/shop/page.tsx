import type { Metadata } from 'next';
import { HorizontalRail, ScrollStage } from '@nowcore/motion';
import { dropLabel, formatInr } from '@nowcore/shared';
import { archive, liveDrop } from '../../lib/api';
import { currentCart } from '../../features/cart/cart';
import { FilmChrome } from '../../features/film/Chrome';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Shop — NOWCORE',
  alternates: { canonical: '/shop' },
};

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

/** The shop (T-046): every drop on one sideways rail — live first, the archive after. */
export default async function Shop() {
  const [drop, closed, cart] = await Promise.all([
    liveDrop(),
    archive(),
    currentCart(),
  ]);
  const product = drop.products[0];
  const panels = [
    {
      key: drop.slug,
      live: drop.status === 'LIVE',
      label: dropLabel(drop.number),
      title: drop.title,
      href: product ? `/product/${product.slug}` : '/',
      still: product?.colourways[0]?.frames?.still ?? drop.still,
      price: product ? formatInr(product.fromPaise) : '',
      meta: drop.editionSize
        ? `${drop.editionSize - drop.claimed} left`
        : 'Open edition',
    },
    ...closed.map((d) => ({
      key: d.slug,
      live: false,
      label: dropLabel(d.number),
      title: d.title,
      href: `/#the-archive`,
      still: d.still,
      price: 'Sold out',
      meta: d.closesAt
        ? dateFmt.format(new Date(d.closesAt)).toUpperCase()
        : '',
    })),
  ];

  return (
    <main className="bg-void font-sans text-paper">
      <FilmChrome
        drop={drop}
        buyHref={product ? `/product/${product.slug}` : '/'}
        current="shop"
        cartCount={cart?.count ?? 0}
      />
      <ScrollStage
        id="the-rail"
        label="Every drop"
        length={Math.max(1.5, 1 + panels.length * 0.45)}
      >
        <div className="flex h-full flex-col justify-center gap-8 pt-20">
          <div className="mx-auto flex w-full max-w-[1360px] flex-wrap items-end justify-between gap-6 px-6 md:px-10">
            <div>
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-smoke">
                The shop · {panels.length} drops
              </p>
              <h1 className="flex flex-wrap items-baseline gap-x-3.5">
                <span className="text-[clamp(2.5rem,5vw,3.125rem)] font-medium tracking-[-0.04em]">
                  Everything
                </span>
                <span className="font-serif text-[clamp(2.75rem,5.5vw,3.375rem)] italic">
                  we have made.
                </span>
              </h1>
            </div>
            <p className="font-mono text-[11px] uppercase leading-[1.9] tracking-[0.16em] text-ghost md:text-right">
              Scroll to move sideways
              <br />
              {panels.filter((p) => p.live).length} live · {closed.length}{' '}
              archived
            </p>
          </div>
          <HorizontalRail
            label="Drops"
            className="pl-6 md:pl-[max(2.5rem,calc((100vw-1360px)/2+2.5rem))]"
          >
            {panels.map((p) => (
              <a
                key={p.key}
                href={p.href}
                className={`mr-[18px] flex w-[min(304px,78vw)] flex-col overflow-hidden rounded-[5px] border ${p.live ? 'border-paper/20 bg-ash/60' : 'border-steel bg-ash/30'}`}
              >
                <div
                  className={`relative flex h-[min(46svh,380px)] items-center justify-center ${p.live ? '' : 'grayscale'}`}
                >
                  {p.still && (
                    <img
                      src={p.still}
                      alt=""

                      className={`h-[85%] w-auto ${p.live ? '' : 'opacity-45'}`}
                    />
                  )}
                  {p.live ? (
                    <span className="absolute left-3.5 top-3.5 font-mono text-[10px] tracking-[0.2em] text-accent">
                      LIVE
                    </span>
                  ) : (
                    <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-y border-steel py-1.5 text-center font-mono text-[10px] tracking-[0.24em] text-smoke">
                      ARCHIVED
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2 border-t border-steel px-5 pb-5 pt-4">
                  <span className="font-mono text-[10px] tracking-[0.18em] text-ghost">
                    {p.label}
                  </span>
                  <span
                    className={`text-[17px] leading-snug ${p.live ? 'text-paper' : 'text-smoke'}`}
                  >
                    {p.title}
                  </span>
                  <span className="mt-1 flex items-baseline justify-between gap-3">
                    <span
                      className={`font-mono text-sm ${p.live ? 'text-paper' : 'text-ghost'}`}
                    >
                      {p.price}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ghost">
                      {p.meta}
                    </span>
                  </span>
                </div>
              </a>
            ))}
          </HorizontalRail>
        </div>
      </ScrollStage>
    </main>
  );
}
