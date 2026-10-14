import { SIGNAL } from '@nowcore/ui';
import { liveDrop } from '../lib/api';
import { CARD, shareCard } from '../features/seo/card';

export const alt = 'NOWCORE — the live drop';
export const size = CARD;
export const contentType = 'image/png';
// Rendered on request: at build time there is no catalogue to ask.
export const dynamic = 'force-dynamic';

/** The homepage card is the live drop's: sharing the site shares what is on sale now. */
export default async function Image() {
  const drop = await liveDrop().catch(() => null);
  return shareCard({
    number: drop?.number ?? null,
    title: drop?.title ?? 'Wear the moment.',
    accent: drop?.accentColor ?? SIGNAL,
    line: '72 hours. Printed to order. Never restocked.',
  });
}
