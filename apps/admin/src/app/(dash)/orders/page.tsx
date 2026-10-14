import { AdminOrderList, formatInr } from '@nowcore/shared';
import { get } from '../../../lib/api';
import { LiveRefresh } from '../../../features/LiveRefresh';
import { StatusPill, micro } from '../../../features/ui';

export const dynamic = 'force-dynamic';

const TABS = [
  ['', 'All'],
  ['attention', 'Needs you'],
  ['PAID', 'Paid'],
  ['PRINTING', 'Printing'],
  ['SHIPPED', 'Shipped'],
  ['PENDING', 'Awaiting payment'],
] as const;

const time = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

/** The order board (T-069). Search and filters are plain GET forms and links. */
export default async function Orders({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status = '', q = '' } = await searchParams;
  const params = new URLSearchParams({
    ...(status ? { status } : {}),
    ...(q ? { q } : {}),
  });
  const { orders, counts } = await get(
    `/admin/orders?${params}`,
    AdminOrderList,
  );
  const total = Object.entries(counts)
    .filter(([k]) => k !== 'attention')
    .reduce((t, [, n]) => t + n, 0);

  return (
    <main className="flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-steel px-5 py-3.5">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium">Orders</h1>
          <LiveRefresh />
        </div>
        <form
          role="search"
          className="flex min-w-[240px] flex-1 items-center gap-2 md:max-w-[420px]"
        >
          {status && <input type="hidden" name="status" value={status} />}
          <label htmlFor="q" className={micro}>
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Order, email, phone, SKU"
            className="min-h-9 min-w-0 flex-1 rounded border border-steel bg-ash px-3 text-[13px] text-paper outline-none focus:border-paper/40"
          />
        </form>
      </header>

      <nav
        aria-label="Filter"
        className="flex flex-wrap gap-1.5 border-b border-steel px-5 py-3"
      >
        {TABS.map(([value, label]) => {
          const n = value === '' ? total : (counts[value] ?? 0);
          const on = status === value;
          return (
            <a
              key={value}
              href={value ? `/orders?status=${value}` : '/orders'}
              aria-current={on ? 'page' : undefined}
              className={`inline-flex min-h-7 items-center gap-2 rounded-full border px-3 font-mono text-[10px] uppercase tracking-[0.12em] ${on ? 'border-paper/30 text-paper' : 'border-steel text-ghost'}`}
            >
              {label}
              <span
                className={value === 'attention' && n > 0 ? 'text-bad' : ''}
              >
                {n}
              </span>
            </a>
          );
        })}
      </nav>

      <div className="overflow-x-auto px-5 py-4">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className={`${micro} border-b border-steel`}>
              <th scope="col" className="py-2 font-normal">
                Order
              </th>
              <th scope="col" className="py-2 font-normal">
                Customer
              </th>
              <th scope="col" className="py-2 font-normal">
                Items
              </th>
              <th scope="col" className="py-2 font-normal">
                Pay
              </th>
              <th scope="col" className="py-2 font-normal">
                Status
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                Total
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                Placed
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.reference}
                className="border-b border-steel/50 hover:bg-ash/40"
              >
                <td className="py-2.5">
                  <a
                    href={`/orders/${o.reference}`}
                    className="font-mono text-[11px] text-paper underline-offset-4 hover:underline"
                  >
                    {o.reference}
                  </a>
                </td>
                <td className="py-2.5 text-xs text-paper-dim">
                  {o.email}
                  {o.city && <span className="text-ghost"> · {o.city}</span>}
                </td>
                <td className="py-2.5 font-mono text-[10px] text-ghost">
                  {o.summary}
                </td>
                <td className="py-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-smoke">
                  {o.method ?? '—'}
                </td>
                <td className="py-2.5">
                  <StatusPill status={o.status} />
                </td>
                <td className="py-2.5 text-right font-mono text-xs">
                  {formatInr(o.totalPaise)}
                </td>
                <td className="py-2.5 text-right font-mono text-[10px] text-ghost">
                  {time.format(new Date(o.createdAt))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <p className="py-8 text-center text-smoke">Nothing here.</p>
        )}
      </div>
    </main>
  );
}
