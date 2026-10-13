import { liveDrop } from '../lib/fixtures/live-drop';
import { FilmChrome } from '../features/film/Chrome';
import { Signal } from '../features/film/Signal';

/**
 * The film. Chapter 00 lands with T-037; chapters 01–06 follow (T-038–T-043).
 * Until then a plain block marks where the next chapter starts, so the stage
 * can be scrolled past and released.
 */
export default function Home() {
  return (
    <main className="bg-void text-paper font-sans">
      <FilmChrome closesAt={liveDrop.closesAt} />
      <Signal drop={liveDrop} />
      <section
        id="whats-now"
        aria-label="What's now"
        className="flex min-h-svh items-center px-6 md:px-16"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-smoke">
          01 / What&apos;s now — next (T-038)
        </p>
      </section>
    </main>
  );
}
