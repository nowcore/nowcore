import { dropLabel, type DropSummary } from '@nowcore/shared';
import { Countdown } from './Countdown';

const navLink =
  'min-h-10 inline-flex items-center px-[18px] rounded-full text-sm text-paper-dim hover:text-paper transition-colors';
const navActive =
  'min-h-10 inline-flex items-center px-[18px] rounded-full text-sm bg-paper text-void';

/** Header and dock: fixed over every storefront page, glass, always reachable. */
export function FilmChrome({
  drop,
  buyHref,
  current = 'drop',
  cartCount = 0,
}: {
  drop: DropSummary;
  /** Where "Take it" goes — the live drop's product. */
  buyHref: string;
  current?: 'drop' | 'shop' | 'none';
  cartCount?: number;
}) {
  return (
    <>
      {/* Seven stops of chrome before the page on every Tab-through (T-092).
          Hidden until focused; its target sits after all the chrome. */}
      <a
        href="#content"
        className="sr-only z-50 rounded bg-paper text-sm font-medium text-void focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:px-4 focus:py-3"
      >
        Skip to content
      </a>
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
          className="hidden items-center gap-0.5 rounded-full border border-paper/10 bg-ash/70 p-1.5 backdrop-blur-xl md:inline-flex"
        >
          <a
            href="/"
            aria-current={current === 'drop' ? 'page' : undefined}
            className={current === 'drop' ? navActive : navLink}
          >
            {dropLabel(drop.number).replace('DROP', 'Drop')}
          </a>
          <a
            href="/shop"
            aria-current={current === 'shop' ? 'page' : undefined}
            className={current === 'shop' ? navActive : navLink}
          >
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
          href={buyHref}
          className="inline-flex min-h-11 items-center gap-2.5 rounded-full bg-accent px-5 text-sm font-medium text-void md:px-[22px]"
        >
          Take it <span aria-hidden="true">↗</span>
        </a>
      </header>

      <div className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-0.5 rounded-full border border-paper/10 bg-ash/70 p-1.5 backdrop-blur-xl md:bottom-6 md:right-10">
        {drop.status === 'LIVE' && drop.closesAt && (
          <Countdown
            closesAt={drop.closesAt}
            className="inline-flex min-h-10 items-center px-3.5 font-mono text-xs text-accent"
          />
        )}
        <a
          href="/cart"
          aria-label={`Open cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}
          className="inline-flex min-h-10 min-w-11 items-center justify-center rounded-full bg-paper font-mono text-xs text-void"
        >
          {cartCount}
        </a>
      </div>
      <span id="content" tabIndex={-1} />
    </>
  );
}
