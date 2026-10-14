import { notFound } from 'next/navigation';
import { AdminDropDetail, formatInr } from '@nowcore/shared';
import { get } from '../../../../lib/api';
import { micro } from '../../../../features/ui';
import {
  lifecycle,
  saveChapters,
  saveMappings,
  updateDrop,
  uploadArtwork,
} from '../actions';
import { RenderWatch } from './RenderWatch';

export const dynamic = 'force-dynamic';

const field =
  'min-h-9 w-full rounded border border-steel bg-ash px-2.5 text-[13px] text-paper outline-none focus:border-paper/40';
const btn = 'min-h-9 rounded px-4 text-xs font-medium';
/** datetime-local wants local wall time without a zone. */
const local = (iso: string | null) =>
  iso
    ? new Date(new Date(iso).getTime() + 5.5 * 3_600_000)
        .toISOString()
        .slice(0, 16)
    : '';

/** One drop, end to end (T-064–T-068, T-073): details, artwork, variants, film copy, and opening it. */
export default async function DropPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { slug } = await params;
  const { error, ok } = await searchParams;
  if (!/^[a-z0-9-]+$/.test(slug)) notFound();
  const d = await get(`/admin/drops/${slug}`, AdminDropDetail);
  const editable = d.status === 'DRAFT' || d.status === 'SCHEDULED';
  const colourways = [
    ...new Map(d.variants.map((v) => [v.colourName, v])).values(),
  ];
  const pending = d.product?.hasArtwork
    ? colourways.filter((c) => !c.rendered).length
    : 0;

  return (
    <main className="flex flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-steel px-5 py-3.5">
        <a href="/drops" className="text-xs text-smoke hover:underline">
          Drops
        </a>
        <span className="text-ghost">/</span>
        <span
          aria-hidden="true"
          className="size-3 rounded-full border border-paper/20"
          style={{ background: d.accentColor }}
        />
        <h1 className="text-sm font-medium">
          <span className="font-mono text-ghost">
            {String(d.number).padStart(3, '0')}
          </span>{' '}
          {d.title}
        </h1>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-smoke">
          {d.status.toLowerCase()}
        </span>
      </header>

      {(error || ok) && (
        <p
          role={error ? 'alert' : 'status'}
          className={`mx-5 mt-4 whitespace-pre-line rounded border px-3 py-2 text-sm ${error ? 'border-bad/40' : 'border-ok/30 text-ok'}`}
        >
          {error ?? ok}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 p-5 xl:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-8">
          {/* ---------------- details ---------------- */}
          <section aria-labelledby="details-h">
            <h2 id="details-h" className={`${micro} mb-3`}>
              Details
            </h2>
            <form
              action={updateDrop}
              className="grid grid-cols-1 gap-3 md:grid-cols-2"
            >
              <input type="hidden" name="slug" value={d.slug} />
              {!editable && <input type="hidden" name="locked" value="1" />}
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-[11px] text-smoke">Title</span>
                <input name="title" defaultValue={d.title} className={field} />
              </label>
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-[11px] text-smoke">Description</span>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={d.product?.description}
                  className={`${field} py-2`}
                />
              </label>
              {editable && (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-smoke">Accent</span>
                    <input
                      name="accentColor"
                      defaultValue={d.accentColor}
                      className={`${field} font-mono`}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-smoke">
                      Edition (blank = open)
                    </span>
                    <input
                      name="editionSize"
                      type="number"
                      min={1}
                      defaultValue={d.editionSize ?? ''}
                      className={field}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-smoke">Opens (IST)</span>
                    <input
                      name="opensAt"
                      type="datetime-local"
                      defaultValue={local(d.opensAt)}
                      className={field}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-smoke">Closes (IST)</span>
                    <input
                      name="closesAt"
                      type="datetime-local"
                      defaultValue={local(d.closesAt)}
                      className={field}
                    />
                  </label>
                </>
              )}
              <button
                type="submit"
                className={`${btn} self-start border border-steel text-paper`}
              >
                Save details
              </button>
            </form>
          </section>

          {/* ---------------- artwork ---------------- */}
          <section aria-labelledby="art-h" className="flex flex-col gap-3">
            <h2 id="art-h" className={micro}>
              Artwork &amp; turntables
            </h2>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {colourways.map((c) => (
                <li
                  key={c.colourName}
                  className="flex flex-col items-center gap-2 rounded border border-steel bg-ash/40 p-3"
                >
                  <div className="flex h-28 items-center justify-center">
                    {c.rendered && c.still ? (
                      <img
                        src={c.still}
                        alt={`${d.title} in ${c.colourName}`}
                        className="h-full w-auto"
                      />
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ghost">
                        {d.product?.hasArtwork ? 'rendering…' : 'no artwork'}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-paper-dim">{c.colourName}</span>
                </li>
              ))}
            </ul>
            <RenderWatch pending={pending} />
            {editable && (
              <form
                action={uploadArtwork}
                className="flex flex-wrap items-center gap-3"
              >
                <input type="hidden" name="slug" value={d.slug} />
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-smoke">
                    Print file — transparent PNG, ≥ 600 px, ≤ 8 MB
                  </span>
                  <input
                    name="artwork"
                    type="file"
                    accept="image/png"
                    required
                    className="text-xs text-smoke file:mr-3 file:min-h-9 file:rounded file:border file:border-steel file:bg-ash file:px-3 file:text-paper"
                  />
                </label>
                <button
                  type="submit"
                  className={`${btn} self-end bg-paper text-void`}
                >
                  Upload &amp; render
                </button>
              </form>
            )}
          </section>

          {/* ---------------- variants ---------------- */}
          <section aria-labelledby="var-h">
            <h2 id="var-h" className={`${micro} mb-3`}>
              Variants → printer
            </h2>
            <form action={saveMappings} className="flex flex-col gap-3">
              <input type="hidden" name="slug" value={d.slug} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left">
                  <thead>
                    <tr className={`${micro} border-b border-steel`}>
                      <th scope="col" className="py-2 font-normal">
                        SKU
                      </th>
                      <th scope="col" className="py-2 font-normal">
                        Price
                      </th>
                      <th scope="col" className="py-2 font-normal">
                        Printer variant id
                      </th>
                      <th scope="col" className="py-2 font-normal">
                        Sold out
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.variants.map((v) => (
                      <tr key={v.sku} className="border-b border-steel/40">
                        <td className="py-1.5 font-mono text-[10px] text-paper-dim">
                          <input type="hidden" name="sku" value={v.sku} />
                          {v.sku}
                        </td>
                        <td className="py-1.5 font-mono text-[11px] text-smoke">
                          {formatInr(v.pricePaise)}
                        </td>
                        <td className="py-1.5 pr-3">
                          <input
                            name="podVariantId"
                            defaultValue={v.podVariantId ?? ''}
                            aria-label={`Printer id for ${v.sku}`}
                            placeholder="unmapped"
                            className={`${field} min-h-8 font-mono text-[11px] ${v.podVariantId ? '' : 'border-warn/50'}`}
                          />
                        </td>
                        <td className="py-1.5">
                          <input
                            type="checkbox"
                            name="soldOut"
                            value={v.sku}
                            defaultChecked={v.soldOut}
                            aria-label={`${v.sku} sold out`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="submit"
                className={`${btn} self-start border border-steel text-paper`}
              >
                Save variants
              </button>
            </form>
          </section>

          {/* ---------------- chapters ---------------- */}
          <section aria-labelledby="ch-h">
            <h2 id="ch-h" className={`${micro} mb-3`}>
              The film — seven chapters
            </h2>
            <form action={saveChapters} className="flex flex-col gap-3">
              <input type="hidden" name="slug" value={d.slug} />
              {d.chapters.map((c) => (
                <fieldset
                  key={c.key}
                  className="grid grid-cols-1 gap-2 rounded border border-steel p-3 md:grid-cols-3"
                >
                  <legend className="px-1 font-mono text-[10px] text-ghost">
                    {c.key}
                  </legend>
                  <input type="hidden" name="key" value={c.key} />
                  <input
                    name="kicker"
                    defaultValue={c.kicker}
                    aria-label={`${c.key} kicker`}
                    className={`${field} font-mono text-[11px]`}
                  />
                  <input
                    name="lineOne"
                    defaultValue={c.lineOne}
                    aria-label={`${c.key} line one`}
                    className={field}
                  />
                  <input
                    name="lineTwo"
                    defaultValue={c.lineTwo}
                    aria-label={`${c.key} line two, serif italic`}
                    className={`${field} font-serif italic`}
                  />
                </fieldset>
              ))}
              <button
                type="submit"
                className={`${btn} self-start border border-steel text-paper`}
              >
                Save film copy
              </button>
            </form>
          </section>
        </div>

        {/* ---------------- publish ---------------- */}
        <aside className="flex flex-col gap-4">
          <section
            aria-labelledby="pub-h"
            className="flex flex-col gap-3 rounded border border-steel p-4 xl:sticky xl:top-4"
          >
            <h2 id="pub-h" className={micro}>
              {editable
                ? 'Publish check'
                : d.status === 'LIVE'
                  ? 'Live'
                  : 'Archived'}
            </h2>
            {editable && (
              <>
                {d.problemList.length === 0 ? (
                  <p className="text-sm text-ok">Ready to open.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {d.problemList.map((p) => (
                      <li
                        key={p}
                        className="border-l-2 border-warn pl-2.5 text-xs leading-snug text-paper-dim"
                      >
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
                <form action={lifecycle} className="flex flex-wrap gap-2">
                  <input type="hidden" name="slug" value={d.slug} />
                  <button
                    name="action"
                    value="open"
                    disabled={d.problemList.length > 0}
                    className={`${btn} bg-paper text-void disabled:opacity-40`}
                  >
                    Open now
                  </button>
                  <button
                    name="action"
                    value="schedule"
                    disabled={d.problemList.length > 0}
                    className={`${btn} border border-steel text-paper disabled:opacity-40`}
                  >
                    Schedule
                  </button>
                </form>
                <p className="text-[11px] leading-snug text-ghost">
                  Opening notifies the waitlist once that exists (T-083) — not
                  reversible. Scheduled drops open by hand until the scheduler
                  lands (T-082).
                </p>
              </>
            )}
            {d.status === 'LIVE' && (
              <>
                <p className="font-mono text-xs text-paper-dim">
                  {d.claimed}
                  {d.editionSize ? ` / ${d.editionSize}` : ''} claimed
                </p>
                <form action={lifecycle} className="flex items-end gap-2">
                  <input type="hidden" name="slug" value={d.slug} />
                  <input type="hidden" name="action" value="extend" />
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-smoke">
                      Extend by hours
                    </span>
                    <input
                      name="hours"
                      type="number"
                      min={1}
                      max={72}
                      defaultValue={24}
                      className={`${field} w-24`}
                    />
                  </label>
                  <button
                    type="submit"
                    className={`${btn} border border-steel text-paper`}
                  >
                    Extend
                  </button>
                </form>
                <form action={lifecycle}>
                  <input type="hidden" name="slug" value={d.slug} />
                  <button
                    name="action"
                    value="close"
                    className={`${btn} border border-bad/40 text-bad`}
                  >
                    Close early &amp; archive
                  </button>
                </form>
                <p className="text-[11px] text-ghost">
                  A closed drop is never reopened.
                </p>
              </>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
