import type { ReactNode } from 'react';
import { DRAFT, LEGAL_PAGES, LEGAL_UPDATED } from './business';

/**
 * The frame every policy shares: plain, readable, no motion — these are
 * pages people read carefully, often on a phone, sometimes upset.
 */
export function LegalPage({
  slug,
  intro,
  children,
}: {
  slug: (typeof LEGAL_PAGES)[number]['slug'];
  intro: string;
  children: ReactNode;
}) {
  const title = LEGAL_PAGES.find((p) => p.slug === slug)?.title ?? '';
  return (
    <main className="min-h-svh bg-void px-5 pb-24 pt-8 font-sans text-paper md:px-10">
      <div className="mx-auto flex max-w-[720px] flex-col gap-8">
        <a href="/" className="text-[22px] font-semibold tracking-tight">
          NOWCORE
        </a>
        <nav
          aria-label="Policies"
          className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em]"
        >
          {LEGAL_PAGES.map((p) => (
            <a
              key={p.slug}
              href={`/legal/${p.slug}`}
              aria-current={p.slug === slug ? 'page' : undefined}
              className={
                p.slug === slug ? 'text-paper' : 'text-smoke hover:text-paper'
              }
            >
              {p.title}
            </a>
          ))}
        </nav>
        {DRAFT && (
          <p
            role="note"
            className="rounded border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-paper-dim"
          >
            Draft. Details in [brackets] are filled in before launch.
          </p>
        )}
        <header className="flex flex-col gap-3">
          <h1 className="text-[clamp(2.25rem,5vw,3rem)] font-medium leading-[1] tracking-[-0.04em]">
            {title}
          </h1>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ghost">
            Last updated {LEGAL_UPDATED}
          </p>
          <p className="text-[17px] leading-relaxed text-paper-dim">{intro}</p>
        </header>
        <div className="legal flex flex-col gap-8 text-[15px] leading-relaxed text-paper-dim">
          {children}
        </div>
      </div>
    </main>
  );
}

/** A titled section. */
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium text-paper">{title}</h2>
      {children}
    </section>
  );
}

/** A bulleted list, styled once. */
export function List({ children }: { children: ReactNode }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-ghost">
      {children}
    </ul>
  );
}
