import type { MetadataRoute } from 'next';
import { env } from '../env';

/** Private and transactional pages stay out of the index; each also says noindex itself. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/cart', '/checkout', '/order/', '/unsubscribe', '/api/'],
    },
    sitemap: `${env.SITE_URL}/sitemap.xml`,
  };
}
