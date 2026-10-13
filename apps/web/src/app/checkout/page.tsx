import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { STATES, formatInr, priceOrder } from '@nowcore/shared';
import { currentCart } from '../../features/cart/cart';
import { CheckoutForm } from '../../features/checkout/CheckoutForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Checkout — NOWCORE',
  robots: { index: false },
};

/** Checkout (T-050). Composed and calm: the film ends at the cart. */
export default async function Checkout() {
  const cart = await currentCart();
  if (!cart || cart.count === 0) redirect('/cart');
  const totals = priceOrder(cart.subtotalPaise, 'PREPAID');

  return (
    <main className="min-h-svh bg-void font-sans text-paper">
      <header className="flex items-center justify-between px-5 py-6 md:px-10">
        <a href="/" className="text-[22px] font-semibold tracking-tight">
          NOWCORE
        </a>
        <a
          href="/cart"
          className="text-sm text-smoke underline underline-offset-4"
        >
          Back to cart
        </a>
      </header>
      <div className="mx-auto grid max-w-[1080px] grid-cols-1 gap-12 px-5 pb-24 md:grid-cols-[1fr_340px] md:px-10">
        <div className="flex flex-col gap-8">
          <h1 className="text-[clamp(2.25rem,4vw,2.75rem)] font-medium tracking-[-0.035em]">
            Checkout
          </h1>
          <CheckoutForm states={STATES} subtotalPaise={cart.subtotalPaise} />
        </div>
        <aside
          aria-label="Order summary"
          className="flex h-fit flex-col gap-4 rounded border border-steel bg-ash/30 p-5 md:sticky md:top-6"
        >
          <ul className="flex flex-col gap-3">
            {cart.lines.map((l) => (
              <li key={l.sku} className="flex justify-between gap-4 text-sm">
                <span className="text-paper-dim">
                  {l.title} · {l.colourName} · {l.size} × {l.quantity}
                </span>
                <span className="font-mono text-paper">
                  {formatInr(l.pricePaise * l.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-2 border-t border-steel pt-4 font-mono text-xs">
            <div className="flex justify-between text-smoke">
              <dt>Subtotal</dt>
              <dd>{formatInr(totals.subtotalPaise)}</dd>
            </div>
            <div className="flex justify-between text-smoke">
              <dt>Shipping</dt>
              <dd>
                {totals.shippingPaise
                  ? formatInr(totals.shippingPaise)
                  : 'Free'}
              </dd>
            </div>
            <div className="flex justify-between text-ghost">
              <dt>Includes GST</dt>
              <dd>{formatInr(totals.taxPaise)}</dd>
            </div>
            <div className="mt-2 flex justify-between text-base text-paper">
              <dt>Total</dt>
              <dd>{formatInr(totals.totalPaise)}</dd>
            </div>
          </dl>
          <p className="text-xs text-ghost">
            COD adds ₹80, shown before you place the order.
          </p>
        </aside>
      </div>
    </main>
  );
}
