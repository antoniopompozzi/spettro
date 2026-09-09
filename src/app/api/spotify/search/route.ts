import { OrderError } from '@/lib/server/errors';
import { debug, failureDetail } from '@/lib/server/log';
import {
  RateLimited,
  SUGGEST_LIMIT,
  enforceRateLimit,
  rateLimitedResponse,
} from '@/lib/server/rate-limit';
import { searchSuggestions } from '@/lib/server/spotify';

// The token cache wants a process that outlives one request.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Below this a query is not yet a query. One letter matches most of the
 * catalogue, so the answer would be noise, and it would be requested on the
 * first keystroke of every slot.
 */
const MIN_QUERY = 2;
/** Long enough for any title and artist together; anything longer is a mistake. */
const MAX_QUERY = 120;

/**
 * Suggestions for the Discover seed picker.
 *
 * A GET, because it reads and nothing else — and it is the listener's own token
 * that reads, since this app has no client secret and so no way to search as
 * itself.
 *
 * A query too short to be one answers an empty list rather than an error: the
 * caller is a field somebody is still typing into, and there is nothing wrong
 * for it to report.
 */
export async function GET(request: Request) {
  try {
    enforceRateLimit(request, 'suggest', SUGGEST_LIMIT);

    const query = (new URL(request.url).searchParams.get('q') ?? '').slice(0, MAX_QUERY).trim();
    if (query.length < MIN_QUERY) return Response.json({ results: [] });

    const results = await searchSuggestions(query);

    // Counts only: what somebody typed into a search box is as much a statement
    // about their taste as the playlist they pasted.
    console.info(`[suggest] ${results.length} results`);
    debug(`[suggest] query "${query}"`);
    return Response.json({ results });
  } catch (error) {
    if (error instanceof RateLimited) return rateLimitedResponse(error);
    if (error instanceof OrderError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('[suggest] unexpected failure', failureDetail(error));
    return Response.json({ error: 'Spettro could not search Spotify. Try again.' }, { status: 500 });
  }
}
