import { z } from 'zod';
import { AdminCustomer, formatInr } from '@nowcore/shared';
import { get } from '../../../lib/api';
import { micro } from '../../../features/ui';

export const dynamic = 'force-dynamic';
const day = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

/** Buyers by email (T-072). RTO count is here because COD policy (docs/11) is decided per buyer. */
export default async function Customers() {
  const customers = await get('/admin/customers', z.array(AdminCustomer));
  return (
    <main className="flex flex-col">
      <header className="border-b border-steel px-5 py-3.5">
        <h1 className="text-sm font-medium">
          Customers{' '}
          <span className="font-mono text-xs text-ghost">
            {customers.length}
          </span>
        </h1>
      </header>
      <div className="overflow-x-auto px-5 py-4">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className={`${micro} border-b border-steel`}>
              <th scope="col" className="py-2 font-normal">
                Customer
              </th>
              <th scope="col" className="py-2 font-normal">
                Cities
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                Orders
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                Delivered
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                RTO
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                Spent
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                Last order
              </th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.email} className="border-b border-steel/50">
                <td className="py-2.5">
                  <a
                    href={`/orders?q=${encodeURIComponent(c.email)}`}
                    className="text-paper underline-offset-4 hover:underline"
                  >
                    {c.email}
                  </a>
                  <span className="block font-mono text-[10px] text-ghost">
                    {c.phone}
                  </span>
                </td>
                <td className="py-2.5 text-xs text-smoke">
                  {c.cities.join(', ') || '—'}
                </td>
                <td className="py-2.5 text-right font-mono text-xs">
                  {c.orders}
                </td>
                <td className="py-2.5 text-right font-mono text-xs">
                  {c.delivered}
                </td>
                <td
                  className={`py-2.5 text-right font-mono text-xs ${c.rto ? 'text-warn' : 'text-ghost'}`}
                >
                  {c.rto}
                </td>
                <td className="py-2.5 text-right font-mono text-xs">
                  {formatInr(c.spentPaise)}
                </td>
                <td className="py-2.5 text-right font-mono text-[10px] text-ghost">
                  {day.format(new Date(c.lastOrderAt))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <p className="py-8 text-center text-smoke">No buyers yet.</p>
        )}
      </div>
    </main>
  );
}
