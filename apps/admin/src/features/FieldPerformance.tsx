import { AdminRum, type RumMetric } from '@nowcore/shared';
import { get } from '../lib/api';
import { micro } from './ui';

/** The budgets (docs/01 NFR-1, NFR-2). Scroll is in fps, the rest as measured. */
const ROWS: {
  metric: RumMetric;
  label: string;
  unit: string;
  ok: (v: number) => boolean;
}[] = [
  {
    metric: 'SCROLL_FT95',
    label: 'Scroll, p95 frame',
    unit: 'fps',
    ok: (v) => v >= 55,
  },
  { metric: 'LCP', label: 'LCP', unit: 'ms', ok: (v) => v < 2500 },
  { metric: 'INP', label: 'INP', unit: 'ms', ok: (v) => v < 200 },
  { metric: 'CLS', label: 'CLS', unit: '', ok: (v) => v < 0.1 },
];
const SEGMENTS = ['all', 'low-end', 'full', 'reduced', 'static'] as const;
/** Below this, a number is an anecdote: shown, but not judged. */
const ENOUGH = 20;

/**
 * Field performance (T-094): what real visits measured over the last week,
 * against the budgets. "Low-end" is ≤ 4 cores or ≤ 4 GB — the phones the
 * Phase 2 gate is about.
 */
export async function FieldPerformance() {
  const rum = await get('/admin/rum?days=7', AdminRum);
  return (
    <section
      aria-labelledby="rum-h"
      className="border-b border-steel px-5 py-4"
    >
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 id="rum-h" className="text-sm font-medium">
          Field performance
        </h2>
        <span className={micro}>
          last 7 days · {rum.pageViews} page views · p75
        </span>
      </div>
      {rum.pageViews === 0 ? (
        <p className="text-sm text-smoke">No visits measured yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className={`${micro} border-b border-steel`}>
                <th scope="col" className="py-2 font-normal">
                  Metric
                </th>
                {SEGMENTS.map((s) => (
                  <th
                    key={s}
                    scope="col"
                    className="py-2 text-right font-normal"
                  >
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.metric} className="border-b border-steel/50">
                  <th
                    scope="row"
                    className="py-2 text-xs font-normal text-paper-dim"
                  >
                    {r.label}
                  </th>
                  {SEGMENTS.map((s) => {
                    const cell = rum.table[r.metric]?.[s];
                    const v = cell?.value ?? null;
                    const judged = v !== null && (cell?.samples ?? 0) >= ENOUGH;
                    return (
                      <td
                        key={s}
                        className={`py-2 text-right font-mono text-xs ${!judged ? 'text-ghost' : r.ok(v) ? 'text-ok' : 'text-bad'}`}
                        title={cell ? `${cell.samples} samples` : 'no samples'}
                      >
                        {v === null ? '—' : `${v}${r.unit ? ` ${r.unit}` : ''}`}
                        {cell && cell.samples < ENOUGH && (
                          <span className="sr-only">
                            {' '}
                            (too few samples to judge)
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
