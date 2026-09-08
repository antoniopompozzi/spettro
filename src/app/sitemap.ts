import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/server/base-url';

/**
 * Three pages, and there will not be more.
 *
 * Everything Spettro actually produces is a sequence of somebody's own
 * playlist, which exists behind a Spotify sign-in and lives at the same `/`
 * as the empty state — it is client state, not a URL a crawler could reach or
 * would be welcome at. So the sitemap lists the home page in its signed-out
 * form and the two legal pages, which are the only public documents here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: absoluteUrl('/'),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: absoluteUrl('/privacy'),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: absoluteUrl('/terms'),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
  ];
}
