import { z } from 'zod';
import { AdminDropRow } from '@nowcore/shared';
import { get } from '../../../lib/api';
import { micro } from '../../../features/ui';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, string> = {
  DRAFT: 'text-smoke bg-paper/5',
  SCHEDULED: 'text-info bg-info/10',
  LIVE: 'text-accent bg-accent/10',
  ARCHIVED: 'text-ghost bg-paper/5',
};
const day = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

/** Every drop, newest first (T-064). */
export default async function Drops() {
  const drops = await get('/admin/drops', z.array(AdminDropRow));
  return (
    <main className="flex flex-col">
      <header className="flex items-center justify-between border-b border-steel px-5 py-3.5">
        <h1 className="text-sm font-medium">Drops</h1>
        <a
          href="/drops/new"
          className="inline-flex min-h-8 items-center rounded bg-paper px-3 text-xs font-medium text-void"
        >
          New drop
        </a>
      </header>
      <div className="overflow-x-auto px-5 py-4">
        <table className="w-full min-w-[680px] text-left">
          <thead>
            <tr className={`${micro} border-b border-steel`}>
              <th scope="col" className="py-2 font-normal">
                Drop
              </th>
              <th scope="col" className="py-2 font-normal">
                Status
              </th>
              <th scope="col" className="py-2 font-normal">
                Window
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                Claimed
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                Blocking
              </th>
            </tr>
          </thead>
          <tbody>
            {drops.map((d) => (
              <tr
                key={d.slug}
                className="border-b border-steel/50 hover:bg-ash/40"
              >
                <td className="py-2.5">
                  <a
                    href={`/drops/${d.slug}`}
                    className="flex items-center gap-2.5"
                  >
                    <span
                      aria-hidden="true"
                      className="size-3 rounded-full border border-paper/20"
                      style={{ background: d.accentColor }}
                    />
                    <span className="font-mono text-[11px] text-ghost">
                      {String(d.number).padStart(3, '0')}
                    </span>
                    <span className="text-paper underline-offset-4 hover:underline">
                      {d.title}
                    </span>
                  </a>
                </td>
                <td className="py-2.5">
                  <span
                    className={`inline-flex min-h-[22px] items-center rounded-[3px] px-2 font-mono text-[9px] uppercase tracking-[0.14em] ${STATUS[d.status]}`}
                  >
                    {d.status.toLowerCase()}
                  </span>
                </td>
                <td className="py-2.5 font-mono text-[10px] text-smoke">
                  {d.opensAt ? day.format(new Date(d.opensAt)) : '—'} →{' '}
                  {d.closesAt ? day.format(new Date(d.closesAt)) : '—'}
                </td>
                <td className="py-2.5 text-right font-mono text-xs">
                  {d.claimed}
                  {d.editionSize ? (
                    <span className="text-ghost"> / {d.editionSize}</span>
                  ) : null}
                </td>
                <td
                  className={`py-2.5 text-right font-mono text-xs ${d.problems ? 'text-warn' : 'text-ghost'}`}
                >
                  {d.problems || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
