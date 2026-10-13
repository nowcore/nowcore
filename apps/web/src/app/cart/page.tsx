import type { Metadata } from 'next';
import { formatInr } from '@nowcore/shared';
import { liveDrop } from '../../lib/api';
import { currentCart } from '../../features/cart/cart';
import { setQuantity } from '../../features/cart/actions';
import { FilmChrome } from '../../features/film/Chrome';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Cart — NOWCORE',
  robots: { index: false },
};

/** The cart (T-049). Quantity changes are plain forms: they work before JavaScript. */
export default async function Cart() {
  const [drop, cart] = await Promise.all([liveDrop(), currentCart()]);
  const lines = cart?.lines ?? [];
  const product = drop.products[0];
  const blocked = lines.some((l) => !l.available);

  return (
    <main className="min-h-svh bg-void font-sans text-paper">
      <FilmChrome
        drop={drop}
        buyHref={product ? `/product/${product.slug}` : '/'}
        current="none"
        cartCount={cart?.count ?? 0}
      />
      <div className="mx-auto flex max-w-[960px] flex-col gap-10 px-5 pb-24 pt-28 md:px-10">
        <h1 className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-[clamp(2.5rem,5vw,3.25rem)] font-medium tracking-[-0.04em]">
            Your
          </span>
          <span className="font-serif text-[clamp(2.75rem,5.5vw,3.5rem)] italic">
            cart.
          </span>
        </h1>

        {lines.length === 0 ? (
          <p className="text-smoke">
            Empty.{' '}
            {product && (
              <a
                href={`/product/${product.slug}`}
                className="text-paper underline underline-offset-4"
              >
                The live drop
              </a>
            )}{' '}
            closes soon.
          </p>
        ) : (
          <>
            <ul className="border-t border-steel">
              {lines.map((l) => (
                <li
                  key={l.sku}
                  className={`flex flex-wrap items-center gap-5 border-b border-steel/60 py-5 ${l.available ? '' : 'opacity-60'}`}
                >
                  <div className="flex size-20 shrink-0 items-center justify-center rounded border border-steel bg-ash/40">
                    {l.still && (
                      <img src={l.still} alt="" className="h-[90%] w-auto" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <a
                      href={`/product/${l.productSlug}`}
                      className="text-[15px] text-paper"
                    >
                      {l.title}
                    </a>
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ghost">
                      {l.colourName} · {l.size} · {l.sku}
                    </span>
                    {!l.available && (
                      <span className="text-sm text-smoke">
                        No longer available — sold out or the drop closed.
                      </span>
                    )}
                  </div>
                  <form
                    action={setQuantity}
                    className="flex items-center gap-1"
                  >
                    <input type="hidden" name="sku" value={l.sku} />
                    <button
                      name="quantity"
                      value={l.quantity - 1}
                      aria-label={`One fewer ${l.title}`}
                      className="size-10 rounded-full border border-steel text-paper"
                    >
                      −
                    </button>
                    <span
                      className="w-8 text-center font-mono text-sm"
                      aria-label="Quantity"
                    >
                      {l.quantity}
                    </span>
                    <button
                      name="quantity"
                      value={l.quantity + 1}
                      disabled={!l.available}
                      aria-label={`One more ${l.title}`}
                      className="size-10 rounded-full border border-steel text-paper disabled:opacity-40"
                    >
                      +
                    </button>
                  </form>
                  <span className="w-20 text-right font-mono text-sm text-paper">
                    {formatInr(l.pricePaise * l.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-6">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-ghost">
                Shipping and tax at checkout · UPI · Cards · COD
              </p>
              <div className="flex items-center gap-6">
                <span className="font-mono text-2xl text-paper">
                  {formatInr(cart?.subtotalPaise ?? 0)}
                </span>
                {blocked ? (
                  <span className="text-sm text-smoke">
                    Remove unavailable items to continue.
                  </span>
                ) : (
                  <a
                    href="/checkout"
                    className="inline-flex min-h-[52px] items-center rounded-full bg-accent px-8 text-[15px] font-medium text-void"
                  >
                    Checkout
                  </a>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
