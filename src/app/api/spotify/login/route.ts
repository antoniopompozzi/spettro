import { AUTH_LIMIT, RateLimited, enforceRateLimit } from '@/lib/server/rate-limit';
import { authorizeUrl, redirectUri } from '@/lib/server/spotify-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sends the listener to Spotify's consent screen.
 *
 * Both routes in this flow are browser navigations — the connect button is a
 * plain link — so both answer a refusal the way the callback answers a denied
 * consent: a redirect home with the reason in `auth_error`, which the form
 * already has a slot for. A bare JSON body would be a correct status code
 * rendered as a dead end, with no way back to the app but the back button.
 */
export async function GET(request: Request) {
  try {
    enforceRateLimit(request, 'auth', AUTH_LIMIT);
  } catch (error) {
    if (!(error instanceof RateLimited)) throw error;
    const home = new URL('/', redirectUri());
    home.searchParams.set('auth_error', error.message);
    return Response.redirect(home, 302);
  }
  return Response.redirect(await authorizeUrl(), 302);
}
