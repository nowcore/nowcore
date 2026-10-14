import { Dashboard, AdminOrderList, formatInr } from '@nowcore/shared';
import { get } from '../../lib/api';
import { StatusPill, micro } from '../../features/ui';
import { LiveRefresh } from '../../features/LiveRefresh';

export const dynamic = 'force-dynamic';

const RANGES = [
  ['today', 'Today'],
  ['7d', '7 days'],
  ['30d', '30 days'],
] as const;

/** The dashboard (T-071): the five numbers worth looking at, and what needs a person. */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const range = Dashboard.shape.range
    .catch('today')
    .parse((await searchParams).range);
  const [d, attention, recent] = await Promise.all([
    get(`/admin/dashboard?range=${range}`, Dashboard),
    get('/admin/orders?status=attention', AdminOrderList),
    get('/admin/orders', AdminOrderList),
  ]);
  const pct = (n: number | null) =>
    n === null ? '—' : `${Math.round(n * 100)}%`;
  const kpis = [
    ['Revenue', formatInr(d.revenuePaise)],
    ['Orders', String(d.orders)],
    ['AOV', formatInr(d.aovPaise)],
    ['COD share', pct(d.codShare)],
    ['Print SLA', pct(d.printSla)],
  ];

  return (
    <main className="flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-steel px-5 py-3.5">
        <h1 className="text-sm font-medium">Dashboard</h1>
        <div className="flex items-center gap-3">
          <LiveRefresh seconds={30} />
          <nav aria-label="Range" className="flex gap-1.5">
            {RANGES.map(([value, label]) => (
              <a
                key={value}
                href={`/?range=${value}`}
                aria-current={range === value ? 'page' : undefined}
                className={`inline-flex min-h-7 items-center rounded-full border px-3 font-mono text-[10px] uppercase tracking-[0.12em] ${range === value ? 'border-paper/30 text-paper' : 'border-steel text-ghost'}`}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-px border-b border-steel bg-steel md:grid-cols-5">
        {kpis.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1.5 bg-void px-5 py-4">
            <dt className={micro}>{k}</dt>
            <dd className="font-mono text-[23px] leading-tight text-paper">
              {v}
            </dd>
          </div>
        ))}
      </dl>

      {d.needsAttention > 0 && (
        <section
          aria-labelledby="att-h"
          className="border-b border-steel px-5 py-4"
        >
          <h2
            id="att-h"
            className="mb-3 flex items-center gap-2 text-sm font-medium text-bad"
          >
            {d.needsAttention}{' '}
            {d.needsAttention === 1 ? 'order needs' : 'orders need'} you
          </h2>
          <ul className="flex flex-col gap-1.5">
            {attention.orders.slice(0, 5).map((o) => (
              <li key={o.reference}>
                <a
                  href={`/orders/${o.reference}`}
                  className="flex items-center gap-3 text-paper-dim hover:text-paper"
                >
                  <span className="font-mono text-[11px]">{o.reference}</span>
                  <StatusPill status={o.status} />
                  <span className="truncate text-xs text-ghost">
                    {o.summary}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="recent-h" className="px-5 py-4">
        <h2 id="recent-h" className="mb-3 text-sm font-medium">
          Recent orders
        </h2>
        <ul className="flex flex-col">
          {recent.orders.slice(0, 8).map((o) => (
            <li key={o.reference} className="border-b border-steel/50">
              <a
                href={`/orders/${o.reference}`}
                className="grid grid-cols-[110px_1fr_auto_80px] items-center gap-3 py-2.5 hover:bg-ash/40"
              >
                <span className="font-mono text-[11px] text-paper-dim">
                  {o.reference}
                </span>
                <span className="truncate text-xs text-paper-dim">
                  {o.email}
                </span>
                <StatusPill status={o.status} />
                <span className="text-right font-mono text-xs">
                  {formatInr(o.totalPaise)}
                </span>
              </a>
            </li>
          ))}
        </ul>
        {recent.orders.length === 0 && (
          <p className="text-smoke">No orders yet.</p>
        )}
      </section>
    </main>
  );
}
