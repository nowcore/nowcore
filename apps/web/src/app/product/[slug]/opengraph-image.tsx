import { formatInr } from '@nowcore/shared';
import { productPage } from '../../../lib/api';
import { CARD, shareCard } from '../../../features/seo/card';

export const alt = 'NOWCORE drop';
export const size = CARD;
export const contentType = 'image/png';

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { drop, product } = await productPage((await params).slug);
  return shareCard({
    number: drop.number,
    title: product.title,
    accent: drop.accentColor,
    line: `From ${formatInr(product.fromPaise)} · ${drop.status === 'LIVE' ? '72 hours only' : 'In the archive'}`,
  });
}
