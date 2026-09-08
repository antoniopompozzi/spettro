import 'server-only';

import { bandIndex } from '@/lib/spectrum';
import type { OrderResponse, Track } from '@/lib/types';

import { mapLimit } from './concurrency';
import { debug } from './log';
import { coverColour, type CoverColour } from './cover';
import { fetchAudioFeatures } from './reccobeats';
import type { SpotifyTrack } from './spotify';

/**
 * How many covers are fetched from Spotify's CDN at once.
 *
 * Lowered from 6 to 4 for the deploy. On this machine the app talks to
 * `i.scdn.co` from one address that nothing else is using; on Vercel it shares
 * an outbound address with every other project on the same infrastructure, so
 * the burst that a fifty-track playlist opens is not the only burst arriving
 * from it. Four keeps the same work going with a third less of it in flight at
 * any instant.
 *
 * This is a guess at the shape of the problem, not a tuned value: the evidence
 * for it is a run that dropped 30 of 50 covers after a session of hammering
 * the CDN, and recovered completely seconds later. The timeout in `cover.ts`
 * is deliberately untouched at 8s — that one waits for real numbers from
 * `meta.dropped` in production rather than a guess made here.
 */
const COVER_CONCURRENCY = 4;

/**
 * Reads every cover and lays the tracks out along the spectrum, which is the
 * whole point of Order.
 *
 * The sequence walks the eleven named bands of `@/lib/spectrum` in order, and
 * sorts each band from its darkest cover to its lightest. Hue leads because
 * that is what "spectrum" means and what the eye groups by: two covers that
 * both read as blue belong side by side, whatever their brightness. The three
 * achromatic bands open the grid, and because each is sorted by lightness too,
 * black, grey and white read as one gradient rather than three blocks.
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
    const swatch = track.swatch ?? track.cover;
    const colour = swatch ? await coverColour(swatch) : null;
    if (!colour) {
      debug(`[order] no cover colour for "${track.title}" — ${track.artist}`);
    }
    return { track, colour };
  });

  const tracks: Track[] = read
    .filter((entry): entry is { track: SpotifyTrack; colour: CoverColour } => entry.colour !== null)
    .sort((a, b) => {
      const band =
        bandIndex(a.colour.hue, a.colour.lightness) - bandIndex(b.colour.hue, b.colour.lightness);
      return band !== 0 ? band : a.colour.lightness - b.colour.lightness;
    })
    .map(({ track, colour }) => {
      const audio = track.spotifyId ? (features.get(track.spotifyId) ?? null) : null;
      return {
        id: track.id,
        title: track.title,
        artist: track.artist,
        color: colour.color,
        hue: colour.hue,
        lightness: colour.lightness,
        bpm: audio?.tempo == null ? null : Math.round(audio.tempo),
        coverUrl: track.cover,
        spotifyUrl: track.spotifyUrl,
        explicit: track.explicit,
        features: audio,
      };
    });

  const dropped = found.length - tracks.length;
  // The count is worth keeping; which covers failed is not, in production.
  if (dropped > 0) console.warn(`[order] ${dropped} of ${found.length} covers could not be read`);

  const withTempo = tracks.filter((track) => track.bpm !== null).length;
  return {
    tracks,
    meta: {
      total: found.length,
      sequenced: tracks.length,
      dropped,
      withTempo,
      withoutTempo: tracks.length - withTempo,
    },
  };
}
