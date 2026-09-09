import 'server-only';

import type { NamedTrack } from '@/lib/match';

import { OrderError } from './errors';
import { debug } from './log';

const ENDPOINT = 'https://ws.audioscrobbler.com/2.0/';
const TIMEOUT_MS = 10_000;

/**
 * How many neighbours are asked for per seed.
 *
 * Deliberately far more than the twenty that are shown. Everything after this
 * point removes candidates — the ones Spotify cannot resolve confidently, the
 * ones whose tempo is nowhere near the seeds' — so the pool has to start wide
 * enough to survive that and still fill a list. Thirty per seed is the margin.
 */
export const SIMILAR_PER_SEED = 30;

/** Last.fm's own codes for "this is your fault", which must not read as "no results". */
const BAD_KEY = new Set([10, 26]);
const RATE_LIMITED = 29;
/** "Invalid parameters" is how Last.fm says it has never heard of the track. */
const NOT_FOUND = 6;

interface SimilarResponse {
  error?: number;
  message?: string;
  similartracks?: {
    track?: Array<{ name?: string; artist?: { name?: string } }> | { name?: string; artist?: { name?: string } };
  };
}

function apiKey(): string {
  const key = process.env.LASTFM_API_KEY;
  if (!key) {
    throw new OrderError(
      500,
      'This Spettro is missing LASTFM_API_KEY. Set it and restart the server.',
    );
  }
  return key;
}

/**
 * The tracks Last.fm considers neighbours of one seed, as plain title and
 * artist text.
 *
 * Last.fm's only job here is to name a pool of plausible candidates. Its `match`
 * score is read and thrown away on purpose: what makes two tracks neighbours in
 * Spettro is the colour of their artwork and the distance between their tempos,
 * and letting a listening-history statistic into the ranking would quietly make
 * the app a thin wrapper around somebody else's idea of similarity.
 *
 * A seed nobody recognises returns nothing rather than failing. Seeds are typed
 * by hand, obscure records exist, and one unknown seed must not take the other
 * two down with it — the caller counts the empties and carries on.
 */
export async function fetchSimilar(seed: NamedTrack): Promise<NamedTrack[]> {
  const query = new URLSearchParams({
    method: 'track.getsimilar',
    track: seed.title,
    artist: seed.artist,
    limit: String(SIMILAR_PER_SEED),
    // Last.fm corrects a misspelled or differently punctuated title against its
    // own catalogue. The seeds arrive from a text field, so this earns its keep.
    autocorrect: '1',
    format: 'json',
    api_key: apiKey(),
  });

  let body: SimilarResponse;
  try {
    const response = await fetch(`${ENDPOINT}?${query}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 429) {
      throw new OrderError(429, 'Last.fm is rate-limiting us right now. Try again in a minute.');
    }
    if (!response.ok) {
      console.warn(`[lastfm] getSimilar answered ${response.status}`);
      return [];
    }
    body = (await response.json()) as SimilarResponse;
  } catch (cause) {
    if (cause instanceof OrderError) throw cause;
    console.warn('[lastfm] getSimilar failed to reach the API');
    return [];
  }

  if (typeof body.error === 'number') {
    // A misconfigured or suspended key would otherwise look exactly like a
    // playlist of obscure records: an empty pool, every single time, with
    // nothing in the log to say why.
    if (BAD_KEY.has(body.error)) {
      throw new OrderError(500, "This Spettro's Last.fm key was refused. Check LASTFM_API_KEY.");
    }
    if (body.error === RATE_LIMITED) {
      throw new OrderError(429, 'Last.fm is rate-limiting us right now. Try again in a minute.');
    }
    if (body.error !== NOT_FOUND) console.warn(`[lastfm] getSimilar error ${body.error}`);
    return [];
  }

  const raw = body.similartracks?.track;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];

  const similar = list.flatMap((entry) => {
    const title = entry?.name?.trim();
    const artist = entry?.artist?.name?.trim();
    return title && artist ? [{ title, artist }] : [];
  });

  debug(`[lastfm] ${similar.length} similar to "${seed.title}" — ${seed.artist}`);
  return similar;
}
