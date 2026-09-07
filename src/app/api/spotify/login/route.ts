import { authorizeUrl } from '@/lib/server/spotify-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Sends the listener to Spotify's consent screen. */
export async function GET() {
  return Response.redirect(await authorizeUrl(), 302);
}
