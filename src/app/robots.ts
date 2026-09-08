import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/server/base-url';

/**
 * What a crawler may see: the signed-out home page and the two legal pages.
 *
 * The two exclusions are the whole point of the file.
 *
 * `/api/` serves nothing a crawler can use — the routes either need a session
 * cookie it does not have or spend somebody's Spotify quota answering it.
 *
 * Any URL carrying a query string is refused because that is where every
 * signed-in state lives: a sequenced grid is not a separate page, it is `/`
 * after a round trip through Spotify, and the round trip leaves `?connected=1`
 * or `?auth_error=…` behind. Those are moments in one listener's session, and
 * indexing them would put a stranger's failed sign-in in a search result.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/*?*'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
