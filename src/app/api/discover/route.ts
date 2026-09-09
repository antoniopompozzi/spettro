import { discover } from '@/lib/server/discover';
import { OrderError } from '@/lib/server/errors';
import { debug, failureDetail } from '@/lib/server/log';
import {
  DISCOVER_LIMIT,
  RateLimited,
  enforceRateLimit,
  rateLimitedResponse,
} from '@/lib/server/rate-limit';
import { isSpotifyTrackId } from '@/lib/server/spotify';
import type { DiscoverSeed } from '@/lib/types';

// Cover decoding uses Node APIs, and the token cache wants a process that
// outlives one request.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The three slots the interface offers, and the most Last.fm is asked about. */
const MAX_SEEDS = 3;
/**
 * Long enough for any real title with its subtitle, short enough that a body
 * cannot arrive carrying a document. Titles this long are truncated rather than
 * refused: the search would have found the record from the first few words.
 */
const MAX_NAME = 200;

const text = (value: unknown): string =>
  typeof value === 'string' ? value.slice(0, MAX_NAME).trim() : '';

/**
 * Reads the seeds out of the body, keeping only what is usable.
 *
 * A seed needs a title and nothing more. `artist` and `spotifyId` arrive
 * together from a resolved pick and are taken when they are there; a seed typed
 * as a bare title has neither, and the engine resolves it against Spotify.
 * A malformed `spotifyId` is dropped rather than refused — the title still
 * names the track, so the seed falls back to a search instead of failing.
 */
function readSeeds(body: unknown): DiscoverSeed[] {
  const given = (body as { seeds?: unknown } | null)?.seeds;
  if (!Array.isArray(given)) return [];

  return given
    .slice(0, MAX_SEEDS)
    .flatMap((entry): DiscoverSeed[] => {
      const title = text((entry as { title?: unknown })?.title);
      if (!title) return [];

      const artist = text((entry as { artist?: unknown })?.artist);
      const spotifyId = text((entry as { spotifyId?: unknown })?.spotifyId);
      return [
        {
          title,
          ...(artist ? { artist } : {}),
          ...(isSpotifyTrackId(spotifyId) ? { spotifyId } : {}),
        },
      ];
    });
}

export async function POST(request: Request) {
  try {
    // Heavier than Order: one call here is up to three requests to Last.fm, five
    // dozen searches on Spotify, as many covers off its CDN and a round of
    // ReccoBeats. The ceiling guards their quotas, not this server's.
    enforceRateLimit(request, 'discover', DISCOVER_LIMIT);

    const seeds = readSeeds(await request.json().catch(() => null));
    if (seeds.length === 0) {
      throw new OrderError(400, 'Type at least one song title to search from.');
    }

    const payload = await discover(seeds);

    // Counts only: which songs somebody searched from stays in development.
    console.info('[discover] ranked', payload.meta);
    debug('[discover] seeds', payload.seeds.map((seed) => `${seed.title} — ${seed.artist}`));
    return Response.json(payload);
  } catch (error) {
    if (error instanceof RateLimited) return rateLimitedResponse(error);
    if (error instanceof OrderError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('[discover] unexpected failure', failureDetail(error));
    return Response.json(
      { error: 'Something went wrong while looking for similar tracks. Try again.' },
      { status: 500 },
    );
  }
}
