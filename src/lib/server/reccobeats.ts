import 'server-only';

import type { AudioFeatures } from '@/lib/types';

import { sleep } from './concurrency';

const ENDPOINT = 'https://api.reccobeats.com/v1/audio-features';
/** 40 is the ceiling: 44 ids in one call comes back 400. */
const BATCH_SIZE = 40;
/** Measured not to trip their rate limit; `Retry-After` is honoured regardless. */
const PACING_MS = 500;
const TIMEOUT_MS = 10_000;
const RETRIES = 3;
const FALLBACK_RETRY_AFTER_S = 2;

interface FeatureRow extends Partial<Record<keyof AudioFeatures, number>> {
  /** `https://open.spotify.com/track/<id>` — how a row maps back to its input. */
  href?: string;
}

const number = (value: number | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function toFeatures(row: FeatureRow): AudioFeatures {
  const tempo = number(row.tempo);
  return {
    // A zero tempo is an absence, not a reading, and must not survive as one.
    tempo: tempo !== null && tempo > 0 ? tempo : null,
    acousticness: number(row.acousticness),
    danceability: number(row.danceability),
    energy: number(row.energy),
    instrumentalness: number(row.instrumentalness),
    key: number(row.key),
    liveness: number(row.liveness),
    loudness: number(row.loudness),
    mode: number(row.mode),
    speechiness: number(row.speechiness),
    valence: number(row.valence),
  };
}

/** One batch, backing off for as long as ReccoBeats asks when it pushes back. */
async function readBatch(ids: readonly string[]): Promise<FeatureRow[]> {
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${ENDPOINT}?ids=${ids.join(',')}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      console.warn('[reccobeats] batch failed to reach the API');
      return [];
    }

    if (response.status === 429) {
      const after = Number(response.headers.get('retry-after')) || FALLBACK_RETRY_AFTER_S;
      console.warn(`[reccobeats] rate-limited, waiting ${after}s`);
      await sleep(after * 1000);
      continue;
    }
    if (!response.ok) {
      console.warn(`[reccobeats] batch answered ${response.status}`);
      return [];
    }
    return ((await response.json()) as { content?: FeatureRow[] }).content ?? [];
  }
  console.warn('[reccobeats] gave up on a batch after repeated rate limiting');
  return [];
}

/**
 * Audio features keyed by Spotify track id. Ids ReccoBeats does not know are
 * simply absent from the map: a miss is normal and never fatal.
 */
export async function fetchAudioFeatures(
  spotifyIds: readonly string[],
): Promise<Map<string, AudioFeatures>> {
  const wanted = [...new Set(spotifyIds)];
  const features = new Map<string, AudioFeatures>();

  for (let i = 0; i < wanted.length; i += BATCH_SIZE) {
    if (i > 0) await sleep(PACING_MS);
    for (const row of await readBatch(wanted.slice(i, i + BATCH_SIZE))) {
      const id = row.href?.split('/track/')[1]?.split(/[?#]/)[0];
      if (id) features.set(id, toFeatures(row));
    }
  }

  const missing = wanted.length - features.size;
  if (missing > 0) console.info(`[reccobeats] no audio features for ${missing} of ${wanted.length}`);
  return features;
}
