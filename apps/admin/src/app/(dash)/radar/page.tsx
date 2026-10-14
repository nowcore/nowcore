import { AdminRadar, SCORE_LINE } from '@nowcore/shared';
import { get } from '../../../lib/api';
import { micro } from '../../../features/ui';
import { decide, promote } from './actions';

export const dynamic = 'force-dynamic';

const SOURCE: Record<string, string> = {
  hn: 'HN',
  google_trends: 'Google',
  reddit: 'Reddit',
  youtube: 'YouTube',
};
const STATUS: Record<string, string> = {
  NEW: 'text-smoke bg-paper/5',
  SHORTLISTED: 'text-info bg-info/10',
  REJECTED: 'text-ghost bg-paper/5 line-through',
  SHIPPED: 'text-accent bg-accent/10',
};
const ago = (iso: string | null) => {
  if (!iso) return 'never';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};
const button =
  'inline-flex min-h-7 items-center rounded border border-steel px-2.5 text-[11px] text-smoke hover:text-paper';

/**
 * The trend radar (T-080). A row is a signal two sources carry above the
 * line inside 24 h — the `new-drop` skill's rule — so anything here may be
 * promoted. Rejected rows sink; the single-source watch list sits below.
 */
export default async function Radar({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const radar = await get('/admin/trends', AdminRadar);
  const rows = [...radar.rows].sort(
    (a, b) => Number(a.status === 'REJECTED') - Number(b.status === 'REJECTED'),
  );
  return (
    <main className="flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-steel px-5 py-3.5">
        <h1 className="text-sm font-medium">Radar</h1>
        <ul className="flex flex-wrap gap-4 font-mono text-[10px] text-ghost">
          {radar.sources.map((s) => (
            <li key={s.source}>
              {SOURCE[s.source]}{' '}
              <span className={s.lastSeenAt ? 'text-smoke' : 'text-warn'}>
                {ago(s.lastSeenAt)}
              </span>
            </li>
          ))}
        </ul>
      </header>
      {error && (
        <p
          role="alert"
          className="border-b border-steel bg-bad/10 px-5 py-2.5 text-xs text-bad"
        >
          {error}
        </p>
      )}
      <section className="px-5 py-4" aria-labelledby="board">
        <h2 id="board" className={`${micro} mb-2`}>
          Two sources ≥ {SCORE_LINE}, last 24 h · {rows.length}
        </h2>
        {rows.length === 0 ? (
          <p className="py-6 text-sm text-smoke">
            Nothing two sources agree on yet. Single-source signals are below.
          </p>
        ) : (
          <ul className="flex flex-col">
            {rows.map((r) => (
              <li
                key={r.key}
                className="flex flex-wrap items-start justify-between gap-3 border-b border-steel/50 py-3"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm text-paper">{r.key}</span>
                    <span className="font-mono text-[10px] text-ghost">
                      heat {r.heat}
                    </span>
                    <span
                      className={`inline-flex min-h-[20px] items-center rounded-[3px] px-2 font-mono text-[9px] uppercase tracking-[0.14em] ${STATUS[r.status]}`}
                    >
                      {r.status.toLowerCase()}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-0.5">
                    {r.sources.map((s) => (
                      <li
                        key={s.source}
                        className="flex gap-2 text-xs text-smoke"
                      >
                        <span className="w-14 shrink-0 font-mono text-[10px] text-ghost">
                          {SOURCE[s.source]} {s.score}
                        </span>
                        {s.url ? (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate hover:text-paper hover:underline"
                          >
                            {s.term}
                          </a>
                        ) : (
                          <span className="truncate">{s.term}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center gap-1.5">
                  {r.status === 'SHIPPED' ? (
                    <a href={`/drops/${r.dropSlug}`} className={button}>
                      Open drop
                    </a>
                  ) : (
                    <>
                      {(['shortlist', 'reject'] as const)
                        .filter(
                          (a) =>
                            r.status !==
                            (a === 'shortlist' ? 'SHORTLISTED' : 'REJECTED'),
                        )
                        .map((action) => (
                          <form key={action} action={decide}>
                            <input type="hidden" name="key" value={r.key} />
                            <input type="hidden" name="action" value={action} />
                            <button className={button}>
                              {action === 'shortlist' ? 'Shortlist' : 'Reject'}
                            </button>
                          </form>
                        ))}
                      {r.status !== 'NEW' && (
                        <form action={decide}>
                          <input type="hidden" name="key" value={r.key} />
                          <input type="hidden" name="action" value="reset" />
                          <button className={button}>Reset</button>
                        </form>
                      )}
                      <form action={promote}>
                        <input type="hidden" name="key" value={r.key} />
                        <button className="inline-flex min-h-7 items-center rounded bg-paper px-2.5 text-[11px] font-medium text-void">
                          Promote to draft
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section
        className="border-t border-steel px-5 py-4"
        aria-labelledby="watch"
      >
        <h2 id="watch" className={`${micro} mb-2`}>
          Watching — one source so far
        </h2>
        <ul className="flex flex-col">
          {radar.watch.map((w) => (
            <li
              key={`${w.source}-${w.term}`}
              className="flex gap-2 border-b border-steel/40 py-1.5 text-xs text-smoke"
            >
              <span className="w-20 shrink-0 font-mono text-[10px] text-ghost">
                {SOURCE[w.source]} {w.score}
              </span>
              {w.url ? (
                <a
                  href={w.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate hover:text-paper hover:underline"
                >
                  {w.term}
                </a>
              ) : (
                <span className="truncate">{w.term}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
