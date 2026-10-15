import type { MetadataRoute } from 'next';
import { env } from '../env';
import { LEGAL_PAGES } from '../features/legal/business';
import { liveDrop } from '../lib/api';

export const dynamic = 'force-dynamic';

/** The pages worth finding: home, shop, and the live drop's products. Archived drops are not for sale. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const drop = await liveDrop().catch(() => null);
  const live = drop?.status === 'LIVE' ? drop : null;
  return [
    { url: `${env.SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${env.SITE_URL}/shop`, changeFrequency: 'daily', priority: 0.8 },
    ...LEGAL_PAGES.map((p) => ({
      url: `${env.SITE_URL}/legal/${p.slug}`,
      changeFrequency: 'yearly' as const,
      priority: 0.2,
    })),
    ...(live?.products ?? []).map((p) => ({
      url: `${env.SITE_URL}/product/${p.slug}`,
      ...(live?.opensAt ? { lastModified: new Date(live.opensAt) } : {}),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    })),
  ];
}
