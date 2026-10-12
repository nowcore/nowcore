import { dropLabel } from '@nowcore/shared';

/**
 * Shell (T-027). Proves the tokens, the three faces and the drop accent render
 * on the server. The film replaces this in Phase 2 (T-037).
 */
export default function Home() {
  return (
    <main className="min-h-dvh bg-void text-paper font-sans flex flex-col">
      <header className="flex items-center justify-between px-10 pt-7">
        <span className="text-[22px] font-semibold tracking-tight">
          NOWCORE
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[var(--tracking-micro)] text-smoke flex items-center gap-2">
          <span
            className="size-1.5 rounded-full bg-accent"
            aria-hidden="true"
          />
          <span className="text-accent">Live</span>
          {dropLabel(14)}
        </span>
      </header>

      <section className="flex-1 flex flex-col justify-center px-10 max-w-5xl">
        <p className="font-mono text-[11px] uppercase tracking-[var(--tracking-micro)] text-smoke mb-6">
          {dropLabel(14)} — Mediocre By Design
        </p>
        <h1 className="leading-[0.94]">
          <span className="block text-[clamp(3rem,8vw,5.75rem)] font-medium tracking-[var(--tracking-film)]">
            Wear the
          </span>
          <span className="block font-serif italic text-[clamp(3.25rem,8.8vw,6.25rem)] -ml-1">
            moment.
          </span>
        </h1>
        <p className="mt-6 max-w-sm text-smoke leading-relaxed">
          Printed the day you order it. Gone in 72 hours. Never restocked.
        </p>
      </section>
    </main>
  );
}
