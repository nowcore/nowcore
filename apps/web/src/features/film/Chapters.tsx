import { formatInr, type DropSummary, type DropView } from '@nowcore/shared';
import { Beat, CanvasSequence, Marquee, ScrollStage } from '@nowcore/motion';
import { trends, wall } from '../../lib/placeholders';
import { WaitlistForm } from '../waitlist/WaitlistForm';
import { chapter } from './copy';
import { ChapterHead } from './Kicker';

const mono = 'font-mono text-[11px] uppercase tracking-[0.18em]';
const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});
const stamp = (iso: string) => dateFmt.format(new Date(iso)).toUpperCase();

/** 01 — what's now. The radar, as a ticker. Not pinned: it reads at a glance. */
export function WhatsNow({ drop }: { drop: DropView }) {
  const c = chapter(drop, 'whats-now');
  return (
    <section
      id="whats-now"
      aria-labelledby="whats-now-h"
      className="border-b border-steel/60 py-24"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-6 md:px-12">
        <div className="flex flex-wrap items-end justify-between gap-7">
          <div id="whats-now-h">
            <ChapterHead kicker={c.kicker} one={c.lineOne} two={c.lineTwo} />
          </div>
          <p className={`${mono} flex items-center gap-2.5 text-smoke`}>
            <span
              className="size-1.5 rounded-full bg-accent"
              aria-hidden="true"
            />{' '}
            Radar · scored hourly
          </p>
        </div>
      </div>
      <div className="mt-10">
        <Marquee label="Trending now" seconds={45}>
          {trends.map((t) => (
            <span
              key={t.term}
              className={`mr-2.5 inline-flex items-center gap-3 rounded-full border bg-ash/40 px-[18px] py-[11px] ${t.score >= 80 ? 'border-paper/20' : 'border-steel'}`}
            >
              <span className="font-mono text-[10px] tracking-[0.14em] text-ghost">
                {t.source}
              </span>
              <span
                className={`text-sm ${t.score >= 80 ? 'text-paper' : 'text-smoke'}`}
              >
                {t.term}
              </span>
              <span
                className={`font-mono text-[11px] ${t.score >= 80 ? 'text-accent' : 'text-ghost'}`}
              >
                {t.score}
              </span>
            </span>
          ))}
        </Marquee>
      </div>
      <p className="mx-auto mt-10 max-w-[1280px] px-6 leading-relaxed text-smoke md:px-12">
        Reddit, Hacker News, Google Trends and YouTube. The ones that cross the
        line become a drop by evening.
      </p>
    </section>
  );
}

/** 02 — the drop. Pinned; the second colourway turns while the specs arrive. */
export function TheDrop({ drop }: { drop: DropView }) {
  const product = drop.products[0];
  const c = product?.colourways[1] ?? product?.colourways[0];
  const f = c?.frames;
  const copy = chapter(drop, 'the-drop');
  const specs = [
    ['Fabric', '200gsm combed cotton, bio-washed'],
    ['Print', 'DTF, 300dpi, crack-resistant'],
    ['Ships', '3–5 days, anywhere in India'],
  ] as const;
  return (
    <ScrollStage id="the-drop" label="The drop" length={2.5}>
      <div className="mx-auto grid h-full max-w-[1280px] grid-cols-1 content-center items-center gap-5 px-5 py-20 md:grid-cols-2 md:gap-10 md:px-12">
        <div className="mx-auto w-[min(220px,24svh)] md:w-full md:max-w-[380px]">
          {f && (
            <CanvasSequence
              frames={f.full}
              reducedFrames={f.reduced}
              fallback={f.still}
              alt={`${drop.title} tee in ${c?.name ?? ''}`}
              width={f.width}
              height={f.height}
            />
          )}
        </div>
        <div className="flex flex-col gap-4 md:gap-7">
          <ChapterHead
            kicker={copy.kicker}
            one={copy.lineOne}
            two={copy.lineTwo}
          />
          <Beat from={0.1} to={0.35} className="hidden md:block">
            <p className="max-w-[440px] leading-relaxed text-smoke">
              {product?.description}
            </p>
          </Beat>
          <Beat from={0.3} to={0.6}>
            <dl className="grid grid-cols-3 gap-3">
              {specs.map(([k, v]) => (
                <div
                  key={k}
                  className="flex flex-col gap-1.5 rounded border border-steel bg-ash/40 px-3 py-3 md:gap-2 md:px-4 md:py-4"
                >
                  <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ghost">
                    {k}
                  </dt>
                  <dd className="text-[13px] leading-snug text-paper md:text-sm">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </Beat>
          <Beat from={0.55} to={0.85}>
            <div className="flex flex-wrap items-center gap-5">
              <span className="font-mono text-[26px] text-paper md:text-[32px]">
                {product ? formatInr(product.fromPaise) : ''}
              </span>
              <a
                href={product ? `/product/${product.slug}` : '/shop'}
                className="inline-flex min-h-[52px] items-center gap-2.5 rounded-full bg-accent px-[30px] text-[15px] font-medium text-void"
              >
                Take it <span aria-hidden="true">↗</span>
              </a>
              <span
                className={`${mono} hidden leading-[1.8] text-ghost md:inline`}
              >
                {drop.claimed} / {drop.editionSize ?? '∞'} claimed
                <br />
                UPI · Cards · COD
              </span>
            </div>
          </Beat>
        </div>
      </div>
    </ScrollStage>
  );
}

/** 03 — the archive. Here, then gone. */
export function TheArchive({
  drop,
  archive,
}: {
  drop: DropView;
  archive: DropSummary[];
}) {
  const c = chapter(drop, 'the-archive');
  return (
    <section
      id="the-archive"
      aria-labelledby="the-archive-h"
      className="border-y border-steel/60 py-24"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-6 md:px-12">
        <div className="flex flex-wrap items-end justify-between gap-7">
          <div id="the-archive-h">
            <ChapterHead kicker={c.kicker} one={c.lineOne} two={c.lineTwo} />
          </div>
          <p className="max-w-[360px] leading-relaxed text-smoke">
            Nothing is restocked. A closed drop keeps its page forever —
            stamped, desaturated, unbuyable.
          </p>
        </div>
        {archive.length === 0 && (
          <p className="text-smoke">
            This is the first one. Nothing has closed yet.
          </p>
        )}
        <ul className="grid grid-cols-2 gap-3.5 md:grid-cols-5">
          {archive.map((d) => (
            <li
              key={d.number}
              className="overflow-hidden rounded border border-steel/70 bg-ash/30"
            >
              <div className="relative flex h-[180px] items-center justify-center grayscale">
                {d.still && (
                  <img
                    src={d.still}
                    alt=""
                    loading="lazy"
                    className="h-[150px] w-auto opacity-40"
                  />
                )}
                <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-y border-steel py-1.5 text-center font-mono text-[10px] tracking-[0.24em] text-smoke">
                  ARCHIVED
                </span>
              </div>
              <div className="flex flex-col gap-1.5 px-4 py-3.5">
                <span className="font-mono text-[10px] tracking-[0.16em] text-ghost">
                  DROP {String(d.number).padStart(3, '0')}
                </span>
                <span className="text-[13px] leading-snug text-smoke">
                  {d.title}
                </span>
                {d.closesAt && (
                  <span className="font-mono text-[10px] tracking-[0.1em] text-ghost">
                    {stamp(d.closesAt)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** 04 — the making. Pinned; three beats arrive in order. */
export function TheMaking({ drop }: { drop: DropView }) {
  const c = chapter(drop, 'the-making');
  const beats = [
    [
      'Signal',
      '09:14',
      'The radar catches it',
      'A phrase crosses the score line on two sources within the same hour. It lands on the shortlist.',
    ],
    [
      'Artwork',
      '14:02',
      'It becomes a garment',
      'Type is set, the print is laid out, the turntable renders itself. The drop gets a number and a colour.',
    ],
    [
      'Press',
      '18:40',
      'It goes live and prints',
      'A 72-hour clock starts. Every order routes straight to the press. Nothing is held in stock.',
    ],
  ] as const;
  return (
    <ScrollStage id="the-making" label="The making" length={2.5}>
      <div className="mx-auto flex h-full max-w-[1280px] flex-col justify-center gap-12 px-6 md:px-12">
        <ChapterHead kicker={c.kicker} one={c.lineOne} two={c.lineTwo} />
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {beats.map(([k, t, h, d], i) => (
            <li key={k}>
              <Beat from={0.15 + i * 0.22} to={0.3 + i * 0.22}>
                <div
                  className={`flex h-full flex-col gap-4 rounded border border-steel bg-ash/40 px-7 py-6 ${i === 0 ? 'border-t-2 border-t-accent' : ''}`}
                >
                  <div className="flex items-baseline justify-between">
                    <span
                      className={`${mono} ${i === 0 ? 'text-accent' : 'text-smoke'}`}
                    >
                      {k}
                    </span>
                    <span className="font-mono text-[11px] text-ghost">
                      {t}
                    </span>
                  </div>
                  <h3 className="text-[26px] font-medium leading-tight tracking-[-0.025em] text-paper">
                    {h}
                  </h3>
                  <p className="text-sm leading-relaxed text-smoke">{d}</p>
                </div>
              </Beat>
            </li>
          ))}
        </ol>
      </div>
    </ScrollStage>
  );
}

/** 05 — the wall. */
export function TheWall({ drop }: { drop: DropView }) {
  const c = chapter(drop, 'the-wall');
  return (
    <section
      id="the-wall"
      aria-labelledby="the-wall-h"
      className="border-y border-steel/60 py-24"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-6 md:px-12">
        <div className="flex flex-wrap items-end justify-between gap-7">
          <div id="the-wall-h">
            <ChapterHead kicker={c.kicker} one={c.lineOne} two={c.lineTwo} />
          </div>
          <a
            href="/wall"
            className="inline-flex min-h-12 items-center gap-2.5 rounded-full border border-steel px-6 text-sm text-paper"
          >
            Add yours <span aria-hidden="true">↗</span>
          </a>
        </div>
        <ul className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {wall.map((h) => (
            <li
              key={h}
              className="relative flex aspect-[3/4] items-end overflow-hidden rounded border border-steel/70 bg-ash/50"
            >
              <span className="w-full bg-gradient-to-t from-void/90 to-transparent p-3 font-mono text-[10px] tracking-[0.1em] text-paper-dim">
                {h}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** 06 — take it. The waitlist and the footer. */
export function TakeIt({ drop }: { drop: DropView }) {
  const c = chapter(drop, 'take-it');
  const links = [
    'Shop',
    'The archive',
    'Size guide',
    'Shipping & returns',
    'Wall of now',
    'Contact',
  ];
  return (
    <section
      id="take-it"
      aria-labelledby="take-it-h"
      className="relative overflow-hidden pb-16 pt-24"
    >
      {/* The watermark is generated content, not text: it is decoration at
          1.1:1 on purpose, and as a text node it failed the contrast audit. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-[4%] bottom-2 whitespace-nowrap text-[clamp(6rem,15vw,12rem)] font-semibold leading-[0.8] tracking-[-0.05em] text-ash before:content-['NOWCORE']"
      />
      <div className="relative mx-auto flex max-w-[1280px] flex-col gap-12 px-6 md:px-12">
        <div className="flex flex-wrap items-end justify-between gap-12">
          <div id="take-it-h" className="flex-[1_1_420px]">
            <ChapterHead
              kicker={c.kicker}
              one={c.lineOne}
              two={c.lineTwo}
              size="film"
            />
          </div>
          <WaitlistForm />
        </div>
        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-x-11 gap-y-4 border-t border-steel/60 pt-7"
        >
          {links.map((l) => (
            <a
              key={l}
              href="/shop"
              className="inline-flex items-center gap-2 text-sm text-paper-dim hover:text-paper"
            >
              {l}{' '}
              <span aria-hidden="true" className="text-ghost">
                →
              </span>
            </a>
          ))}
        </nav>
        <div
          className={`${mono} flex flex-wrap justify-between gap-5 border-t border-steel/60 pt-6 text-ghost`}
        >
          <span>© 2026 NOWCORE · Printed in India</span>
          <span className="flex gap-6">
            <a href="/legal/privacy">Privacy</a>
            <a href="/legal/terms">Terms</a>
            <a href="/legal/shipping">Shipping &amp; returns</a>
          </span>
        </div>
      </div>
    </section>
  );
}
