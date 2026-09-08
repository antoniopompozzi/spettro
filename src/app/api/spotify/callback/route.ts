import { OrderError } from '@/lib/server/errors';
import { failureDetail } from '@/lib/server/log';
import { AUTH_LIMIT, RateLimited, enforceRateLimit } from '@/lib/server/rate-limit';
import { clearOAuthCookies, completeSignIn, redirectUri } from '@/lib/server/spotify-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Where Spotify sends the listener back. Success or failure, the answer is a
 * redirect to the app: `?connected=1`, or `?auth_error=<message>` for the form
 * to show in the slot it shows every other problem in.
 *
 * Unlike the other routes this answers a rate limit with the same redirect
 * rather than a bare 429: whoever lands here is mid-sign-in in a browser, and
 * stranding them on a JSON body leaves no way back to the app.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  // Built from the registered redirect URI, not from `request.url`: the session
  // cookies are scoped to the host Spotify sent the listener back to, and
  // 127.0.0.1 and localhost are different hosts as far as cookies go.
  const home = new URL('/', redirectUri());

  const fail = async (message: string) => {
    // The verifier is spent whatever happened; it must not wait here for a
    // second attempt to pick up.
    await clearOAuthCookies();
    home.searchParams.set('auth_error', message);
    return Response.redirect(home, 302);
  };

  try {
    enforceRateLimit(request, 'auth', AUTH_LIMIT);
  } catch (error) {
    if (error instanceof RateLimited) return fail(error.message);
    throw error;
  }

  const denied = params.get('error');
  if (denied) {
    return fail(
      denied === 'access_denied'
        ? 'Spettro needs access to your playlists to sequence them.'
        : 'Spotify could not complete the sign-in.',
    );
  }

  try {
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) throw new OrderError(400, 'Spotify sent back an incomplete sign-in.');
    await completeSignIn(code, state);
  } catch (error) {
    // Type only in production: a thrown fetch error quotes the URL it failed
    // on, and the token URL carries the code and the verifier.
    console.error('[spotify-auth] sign-in failed', failureDetail(error));
    return fail(
      error instanceof OrderError ? error.message : 'That sign-in did not go through. Try again.',
    );
  }

  await clearOAuthCookies();
  home.searchParams.set('connected', '1');
  return Response.redirect(home, 302);
}
