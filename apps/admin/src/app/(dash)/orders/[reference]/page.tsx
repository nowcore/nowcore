import { notFound } from 'next/navigation';
import { AdminOrderDetail, formatInr } from '@nowcore/shared';
import { get } from '../../../../lib/api';
import { StatusPill, micro } from '../../../../features/ui';
import { act } from './actions';

export const dynamic = 'force-dynamic';

const when = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'Asia/Kolkata',
});

const ACTION = {
  retry: {
    label: 'Retry fulfilment',
    hint: 'Back onto the printer queue. Fix the cause first — an unmapped variant will fail again.',
  },
  cancel: {
    label: 'Cancel order',
    hint: 'Only before payment. Nothing was charged.',
  },
  refund: {
    label: 'Record refund',
    hint: 'Records it here. Issue the money in the Razorpay dashboard — this system does not move it yet.',
  },
} as const;

/** Order detail (T-070): what was bought, where it is, everything that happened to it. */
export default async function OrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { reference } = await params;
  const { error } = await searchParams;
  if (!/^[A-Z0-9-]+$/.test(reference)) notFound();
  const o = await get(`/admin/orders/${reference}`, AdminOrderDetail);
  const address = o.address as Record<string, string | undefined>;

  return (
    <main className="flex flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-steel px-5 py-3.5">
        <a
          href="/orders"
          className="text-xs text-smoke underline-offset-4 hover:underline"
        >
          Orders
        </a>
        <span className="text-ghost">/</span>
        <h1 className="font-mono text-sm">{o.reference}</h1>
        <StatusPill status={o.status} />
      </header>

      {error && (
        <p
          role="alert"
          className="mx-5 mt-4 rounded border border-bad/40 px-3 py-2 text-sm text-paper"
        >
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="items-h">
            <h2 id="items-h" className={`${micro} mb-2`}>
              Items
            </h2>
            <ul className="border-t border-steel">
              {o.lines.map((l) => (
                <li
                  key={l.sku}
                  className="flex justify-between gap-4 border-b border-steel/50 py-2.5"
                >
                  <span>
                    <span className="block text-paper">
                      {l.title} · {l.colour} · {l.size} × {l.quantity}
                    </span>
                    <span className="font-mono text-[10px] text-ghost">
                      {l.sku}
                    </span>
                  </span>
                  <span className="font-mono text-xs">
                    {formatInr(l.pricePaise * l.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 flex flex-col gap-1 font-mono text-xs">
              <div className="flex justify-between text-smoke">
                <dt>Subtotal</dt>
                <dd>{formatInr(o.subtotalPaise)}</dd>
              </div>
              <div className="flex justify-between text-smoke">
                <dt>Shipping{o.method === 'COD' ? ' + COD' : ''}</dt>
                <dd>{formatInr(o.shippingPaise)}</dd>
              </div>
              <div className="flex justify-between text-sm text-paper">
                <dt>Total</dt>
                <dd>{formatInr(o.totalPaise)}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="timeline-h">
            <h2 id="timeline-h" className={`${micro} mb-2`}>
              Timeline
            </h2>
            <ol className="flex flex-col border-l border-steel pl-4">
              {o.events.map((e, i) => (
                <li key={i} className="relative pb-3">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[19.5px] top-1.5 size-[7px] rounded-full bg-steel"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={e.to} />
                    <span className="font-mono text-[10px] text-ghost">
                      {when.format(new Date(e.at))}
                    </span>
                    <span className="font-mono text-[10px] text-smoke">
                      {e.source}
                    </span>
                  </div>
                  {e.payload !== null &&
                    typeof e.payload === 'object' &&
                    Object.keys(e.payload).length > 0 && (
                      <pre className="mt-1 overflow-x-auto font-mono text-[10px] text-ghost">
                        {JSON.stringify(e.payload)}
                      </pre>
                    )}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="flex flex-col gap-5">
          <section
            aria-labelledby="who-h"
            className="rounded border border-steel p-4"
          >
            <h2 id="who-h" className={`${micro} mb-2`}>
              Ship to
            </h2>
            <p className="text-paper">{address['name']}</p>
            <p className="text-xs leading-relaxed text-paper-dim">
              {address['line1']}
              {address['line2'] ? `, ${address['line2']}` : ''}
              <br />
              {address['city']}, {address['state']} {address['pincode']}
            </p>
            <p className="mt-2 font-mono text-[11px] text-smoke">{o.phone}</p>
            <p className="font-mono text-[11px] text-smoke">{o.email}</p>
          </section>

          <section
            aria-labelledby="ids-h"
            className="rounded border border-steel p-4"
          >
            <h2 id="ids-h" className={`${micro} mb-2`}>
              References
            </h2>
            <dl className="flex flex-col gap-1.5 font-mono text-[10px]">
              <div>
                <dt className="text-ghost">Payment</dt>
                <dd className="break-all text-paper-dim">
                  {o.providerOrderId ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-ghost">Printer</dt>
                <dd className="break-all text-paper-dim">
                  {o.podOrderId ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-ghost">Tracking</dt>
                <dd className="break-all text-paper-dim">
                  {o.trackingUrl ? (
                    <a href={o.trackingUrl} className="underline">
                      {o.trackingUrl}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {o.actions.length > 0 && (
            <section
              aria-labelledby="act-h"
              className="flex flex-col gap-3 rounded border border-steel p-4"
            >
              <h2 id="act-h" className={micro}>
                Actions
              </h2>
              {o.actions.map((a) => (
                <form key={a} action={act} className="flex flex-col gap-2">
                  <input type="hidden" name="reference" value={o.reference} />
                  <input type="hidden" name="action" value={a} />
                  {a === 'refund' && (
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-smoke">Note</span>
                      <input
                        name="note"
                        required
                        maxLength={500}
                        className="min-h-9 rounded border border-steel bg-ash px-2.5 text-xs text-paper"
                      />
                    </label>
                  )}
                  <button
                    type="submit"
                    className={`min-h-9 rounded text-xs font-medium ${a === 'retry' ? 'bg-paper text-void' : 'border border-steel text-paper'}`}
                  >
                    {ACTION[a].label}
                  </button>
                  <p className="text-[11px] leading-snug text-ghost">
                    {ACTION[a].hint}
                  </p>
                </form>
              ))}
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
