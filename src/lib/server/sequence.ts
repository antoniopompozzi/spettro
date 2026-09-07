import 'server-only';

import { luminance } from '@/lib/color';
import type { OrderResponse, Track } from '@/lib/types';

import { mapLimit } from './concurrency';
import { dominantColor } from './cover';
import { fetchAudioFeatures } from './reccobeats';
import type { SpotifyTrack } from './spotify';

/** Covers are read a handful at a time: enough to be quick, easy on the CDN. */
const COVER_CONCURRENCY = 6;

/**
 * Reads every cover and lays the tracks out dark to light, which is the whole
 * point of Order.
 *
 * Colour comes from Spotify's own artwork — the only artwork the app may use,
 * and the only one that stays put: a text search against another catalogue
 * returns whichever release is popular today, so the same playlist would drift
 * through the spectrum over time for reasons that have nothing to do with music.
 *
 * Tempo comes from ReccoBeats and nowhere else. A second source would mean two
 * tracks of the same groove sitting on different scales, because tempo
 * estimation is ambiguous by an octave; one source keeps that error systematic,
 * so relative comparisons still hold.
 *
 * A track whose artwork yields no colour cannot be placed on the ramp and is
 * left out, counted in `meta.dropped`. A track with no tempo stays: the absence
 * is carried as `null`, never as a zero.
 */
export async function sequenceTracks(found: readonly SpotifyTrack[]): Promise<OrderResponse> {
  const features = await fetchAudioFeatures(
    found.map((track) => track.spotifyId).filter((id): id is string => Boolean(id)),
  );

  const read = await mapLimit(found, COVER_CONCURRENCY, async (track) => {
    const color = track.cover ? await dominantColor(track.cover) : null;
    if (!color) {
      console.warn(`[order] no cover colour for "${track.title}" — ${track.artist}`);
    }
    return { track, color };
  });

  const tracks: Track[] = read
    .filter((entry): entry is { track: SpotifyTrack; color: string } => entry.color !== null)
    .sort((a, b) => luminance(a.color) - luminance(b.color))
    .map(({ track, color }) => {
      const audio = track.spotifyId ? (features.get(track.spotifyId) ?? null) : null;
      return {
        id: track.id,
        title: track.title,
        artist: track.artist,
        color,
        bpm: audio?.tempo == null ? null : Math.round(audio.tempo),
        coverUrl: track.cover,
        features: audio,
      };
    });

  const withTempo = tracks.filter((track) => track.bpm !== null).length;
  return {
    tracks,
    meta: {
      total: found.length,
      sequenced: tracks.length,
      dropped: found.length - tracks.length,
      withTempo,
      withoutTempo: tracks.length - withTempo,
    },
  };
}
