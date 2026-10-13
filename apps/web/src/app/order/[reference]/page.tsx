import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OrderView, formatInr } from '@nowcore/shared';
import { env } from '../../../env';
import { AwaitPayment } from '../../../features/checkout/AwaitPayment';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Your order — NOWCORE',
  robots: { index: false },
};

const STEPS = ['PAID', 'PRINTING', 'SHIPPED', 'DELIVERED'] as const;
const LABEL: Record<string, string> = {
  PENDING: 'Awaiting payment',
  PAID: 'Confirmed',
  FULFILMENT_QUEUED: 'Sent to the press',
  FULFILMENT_FAILED: 'Delayed — we are on it',
  PRINTING: 'Printing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  RTO: 'Returned',
};

/** Order confirmation and tracking, behind a signed link (docs/05 §6). */
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { reference } = await params;
  const { t } = await searchParams;
  const res = await fetch(
    `${env.API_URL}/orders/${encodeURIComponent(reference)}?t=${encodeURIComponent(t ?? '')}`,
    {
      cache: 'no-store',
    },
  );
  if (res.status === 403 || res.status === 404 || res.status === 400)
    notFound();
  if (!res.ok) throw new Error(`order ${reference}: ${res.status}`);
  const order = OrderView.parse(await res.json());
  const reached =
    order.status === 'FULFILMENT_QUEUED'
      ? 0
      : STEPS.indexOf(order.status as (typeof STEPS)[number]);

  return (
    <main className="min-h-svh bg-void font-sans text-paper">
      <header className="px-5 py-6 md:px-10">
        <a href="/" className="text-[22px] font-semibold tracking-tight">
          NOWCORE
        </a>
      </header>
      <div className="mx-auto flex max-w-[760px] flex-col gap-10 px-5 pb-24 md:px-10">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-smoke">
            Order {order.reference}
          </p>
          <h1 className="leading-[0.96]">
            <span className="block text-[clamp(2.5rem,5vw,3.25rem)] font-medium tracking-[-0.04em]">
              {order.status === 'PENDING' ? 'Almost' : 'It is'}
            </span>
            <span className="-ml-0.5 block font-serif text-[clamp(2.75rem,5.5vw,3.5rem)] italic">
              {order.status === 'PENDING' ? 'there.' : 'yours.'}
            </span>
          </h1>
          {order.status === 'PENDING' ? (
            <AwaitPayment />
          ) : (
            <p className="text-smoke">
              {/* No promise of an email until emails exist (T-062). */}
              {LABEL[order.status]} for {order.email}. Keep this link — it is
              how you track the order.
              {['PAID', 'FULFILMENT_QUEUED', 'PRINTING'].includes(
                order.status,
              ) && ' Printed to order, ships in 3–5 days.'}
            </p>
          )}
        </div>

        {order.status !== 'PENDING' && (
          <ol aria-label="Progress" className="grid grid-cols-4 gap-2">
            {STEPS.map((s, i) => (
              <li key={s} className="flex flex-col gap-2">
                <span
                  className={`h-px ${i <= reached ? 'bg-accent' : 'bg-steel'}`}
                />
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.14em] ${i <= reached ? 'text-paper' : 'text-ghost'}`}
                >
                  {LABEL[s]}
                </span>
              </li>
            ))}
          </ol>
        )}

        <ul className="border-t border-steel">
          {order.lines.map((l) => (
            <li
              key={l.sku}
              className="flex justify-between gap-4 border-b border-steel/60 py-4"
            >
              <span>
                <span className="block text-paper">{l.title}</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ghost">
                  {l.colour} · {l.size} · × {l.quantity}
                </span>
              </span>
              <span className="font-mono text-paper">
                {formatInr(l.pricePaise * l.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-2 font-mono text-sm">
          <div className="flex justify-between text-smoke">
            <dt>Shipping{order.method === 'COD' ? ' + COD' : ''}</dt>
            <dd>
              {order.shippingPaise ? formatInr(order.shippingPaise) : 'Free'}
            </dd>
          </div>
          <div className="flex justify-between text-lg text-paper">
            <dt>Total</dt>
            <dd>{formatInr(order.totalPaise)}</dd>
          </div>
        </dl>
        {order.trackingUrl && (
          <a
            href={order.trackingUrl}
            className="text-paper underline underline-offset-4"
          >
            Track the parcel
          </a>
        )}
      </div>
    </main>
  );
}
