import { Countdown } from './Countdown';

const navLink =
  'min-h-10 inline-flex items-center px-[18px] rounded-full text-sm text-paper-dim hover:text-paper transition-colors';

/** Header and dock: fixed over the film, glass, always reachable. */
export function FilmChrome({ closesAt }: { closesAt: string }) {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex items-start justify-between gap-6 px-6 pt-6 md:px-10">
        <a
          href="/"
          className="py-2.5 text-[22px] font-semibold tracking-tight text-paper"
        >
          NOWCORE
        </a>
        <nav
          aria-label="Primary"
          className="hidden md:inline-flex items-center gap-0.5 rounded-full border border-paper/10 bg-ash/70 p-1.5 backdrop-blur-xl"
        >
          <a
            href="/"
            aria-current="page"
            className={`${navLink} bg-paper text-void hover:text-void`}
          >
            Drop 014
          </a>
          <a href="/shop" className={navLink}>
            Shop
          </a>
          <a href="/#the-archive" className={navLink}>
            Archive
          </a>
          <a href="/#the-wall" className={navLink}>
            Wall
          </a>
        </nav>
        <a
          href="/product/mediocre-by-design-tee"
          className="inline-flex min-h-11 items-center gap-2.5 rounded-full bg-accent px-[22px] text-sm font-medium text-void"
        >
          Take it <span aria-hidden="true">↗</span>
        </a>
      </header>

      <div className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-0.5 rounded-full border border-paper/10 bg-ash/70 p-1.5 backdrop-blur-xl md:right-10">
        <Countdown
          closesAt={closesAt}
          className="inline-flex min-h-10 items-center px-3.5 font-mono text-xs text-accent"
        />
        <a
          href="/cart"
          aria-label="Open cart, 0 items"
          className="inline-flex min-h-10 min-w-11 items-center justify-center rounded-full bg-paper font-mono text-xs text-void"
        >
          0
        </a>
      </div>
    </>
  );
}
