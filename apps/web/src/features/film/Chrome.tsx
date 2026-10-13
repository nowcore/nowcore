import { Countdown } from './Countdown';

const navLink =
  'min-h-10 inline-flex items-center px-[18px] rounded-full text-sm text-paper-dim hover:text-paper transition-colors';

/** Header and dock: fixed over the film, glass, always reachable. */
export function FilmChrome({ closesAt }: { closesAt: string }) {
  return (
    <>
      {/* The backdrop fades from the void so a headline scrolling under the
          header is dimmed rather than collided with. */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-start justify-between gap-6 bg-gradient-to-b from-void via-void/85 to-transparent px-5 pb-8 pt-5 md:px-10 md:pt-6">
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
          className="inline-flex min-h-11 items-center gap-2.5 rounded-full bg-accent px-5 text-sm font-medium text-void md:px-[22px]"
        >
          Take it <span aria-hidden="true">↗</span>
        </a>
      </header>

      <div className="fixed bottom-5 right-5 z-40 md:bottom-6 inline-flex items-center gap-0.5 rounded-full border border-paper/10 bg-ash/70 p-1.5 backdrop-blur-xl md:right-10">
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
