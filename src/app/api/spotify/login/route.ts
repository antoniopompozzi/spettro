import {
  AUTH_LIMIT,
  RateLimited,
  enforceRateLimit,
  rateLimitedResponse,
} from '@/lib/server/rate-limit';
import { authorizeUrl } from '@/lib/server/spotify-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sends the listener to Spotify's consent screen.
 *
 * A refusal answers 429 rather than redirecting: reaching this ceiling means
 * something is starting sign-ins in a loop, and a loop should be told to stop
 * in the status code rather than handed another page.
 */
export async function GET(request: Request) {
  try {
    enforceRateLimit(request, 'auth', AUTH_LIMIT);
  } catch (error) {
    if (error instanceof RateLimited) return rateLimitedResponse(error);
    throw error;
  }
  return Response.redirect(await authorizeUrl(), 302);
}
