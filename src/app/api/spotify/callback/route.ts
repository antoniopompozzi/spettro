import { completeSignIn, redirectUri } from '@/lib/server/spotify-auth';
import { OrderError } from '@/lib/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Where Spotify sends the listener back. Success or failure, the answer is a
 * redirect to the app: `?connected=1`, or `?auth_error=<message>` for the form
 * to show in the slot it shows every other problem in.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  // Built from the registered redirect URI, not from `request.url`: the session
  // cookies are scoped to the host Spotify sent the listener back to, and
  // 127.0.0.1 and localhost are different hosts as far as cookies go.
  const home = new URL('/', redirectUri());

  const denied = params.get('error');
  if (denied) {
    home.searchParams.set(
      'auth_error',
      denied === 'access_denied'
        ? 'Spettro needs access to your playlists to sequence them.'
        : `Spotify could not complete the sign-in (${denied}).`,
    );
    return Response.redirect(home, 302);
  }

  try {
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) throw new OrderError(400, 'Spotify sent back an incomplete sign-in.');
    await completeSignIn(code, state);
    home.searchParams.set('connected', '1');
  } catch (error) {
    console.error('[spotify-auth] sign-in failed', error);
    home.searchParams.set(
      'auth_error',
      error instanceof OrderError ? error.message : 'That sign-in did not go through. Try again.',
    );
  }
  return Response.redirect(home, 302);
}
