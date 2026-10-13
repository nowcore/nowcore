import { formatInr, dropLabel } from '@nowcore/shared';
import {
  Beat,
  CanvasSequence,
  ChapterRail,
  ScrollStage,
  TextReveal,
} from '@nowcore/motion';
import { framesFor, type LiveDrop } from '../../lib/fixtures/live-drop';
import { Countdown } from './Countdown';

/**
 * Chapter 00 — the signal (T-037). Three and a half screens: the stage pins,
 * the garment makes one full turn, the headline holds, and the edition and
 * price arrive as the turn completes.
 */
export function Signal({ drop }: { drop: LiveDrop }) {
  const f = framesFor(drop.slug, drop.colourways[0]?.code ?? 'blk');
  return (
    <ScrollStage id="the-signal" label="The signal" length={3.5}>
      {/* the accent glow behind the garment, and the vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[46%] h-[760px] w-[980px] max-w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(ellipse at center, var(--drop-glow) 0%, transparent 68%)',
        }}
      />

      <div className="absolute left-8 top-1/2 hidden -translate-y-1/2 md:block">
        <ChapterRail index={0} total={7} label="The signal" />
      </div>

      <div className="relative mx-auto grid h-full max-w-[1280px] grid-cols-1 items-center gap-6 px-6 pt-24 pb-28 md:grid-cols-[1fr_minmax(0,380px)_1fr] md:px-16">
        <div className="order-2 flex flex-col gap-5 md:order-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-smoke">
            {dropLabel(drop.number)} — {drop.title}
          </p>
          <TextReveal
            as="h1"
            className="leading-[0.94]"
            lines={['Wear the', 'moment.']}
            lineClassNames={[
              'text-[clamp(2.75rem,6vw,4.75rem)] font-medium tracking-[-0.045em]',
              'font-serif italic text-[clamp(3rem,6.6vw,5.25rem)] -ml-[3px]',
            ]}
          />
          <p className="max-w-[330px] leading-relaxed text-smoke">
            Printed the day you order it. Gone in 72 hours. Never restocked.
          </p>
        </div>

        <div className="order-1 mx-auto w-full max-w-[300px] md:order-2 md:max-w-[380px]">
          <CanvasSequence
            frames={f.full}
            reducedFrames={f.reduced}
            fallback={f.still}
            alt={`${drop.title} tee in ${drop.colourways[0]?.name ?? 'black'}, turning`}
            width={f.width}
            height={f.height}
            className="drop-shadow-[0_40px_70px_var(--void)]"
          />
        </div>

        <div className="order-3 flex flex-col items-start gap-3.5 md:items-end md:text-right">
          <Beat from={0.15} to={0.45}>
            <p className="font-serif italic text-[46px] leading-[1.05] text-paper-dim">
              Already
              <br />
              fading.
            </p>
          </Beat>
          <Beat from={0.55} to={0.85}>
            <p className="font-mono text-[11px] uppercase leading-[1.9] tracking-[0.18em] text-ghost">
              {drop.claimed} of {drop.editionSize} claimed
              <br />
              {formatInr(drop.pricePaise)} · ships 3–5 days
            </p>
          </Beat>
        </div>
      </div>

      <div className="absolute bottom-7 left-6 flex items-center gap-4 md:left-10">
        <span className="font-mono text-[11px] text-paper">00</span>
        <span aria-hidden="true" className="block h-px w-[92px] bg-steel">
          <span className="block h-px w-[22%] bg-accent" />
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-smoke">
          The signal · <Countdown closesAt={drop.closesAt} />
        </span>
      </div>
    </ScrollStage>
  );
}
