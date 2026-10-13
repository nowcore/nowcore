import { TextReveal } from '@nowcore/motion';

/** A chapter's micro-label and its two-line headline (docs/10, the two-line move). */
export function ChapterHead({
  kicker,
  one,
  two,
  size = 'chapter',
}: {
  kicker: string;
  one: string;
  two: string;
  size?: 'chapter' | 'film';
}) {
  const big = size === 'film';
  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-smoke">
        {kicker}
      </p>
      <TextReveal
        as="h2"
        className="leading-[0.96]"
        lines={[one, two]}
        lineClassNames={[
          big
            ? 'text-[clamp(2.75rem,6vw,4rem)] font-medium tracking-[-0.042em]'
            : 'text-[clamp(2.5rem,5vw,3.625rem)] font-medium tracking-[-0.04em]',
          big
            ? 'font-serif italic text-[clamp(3rem,6.6vw,4.25rem)] -ml-0.5'
            : 'font-serif italic text-[clamp(2.75rem,5.5vw,4rem)] -ml-0.5',
        ]}
      />
    </div>
  );
}
