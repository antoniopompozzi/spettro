import { meanHue } from '@/lib/color';
import { BANDS, bandIndex } from '@/lib/spectrum';
import type { Stat, Track } from '@/lib/types';

/** Median, so one track read an octave out does not drag the read-out around. */
function median(values: readonly number[]): number {
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 1
    ? values[middle]
    : Math.round((values[middle - 1] + values[middle]) / 2);
}

/**
 * Tempo across the sequence. Only tracks with a real reading count towards it,
 * and when some are missing the tally says so rather than implying the figure
 * speaks for the whole playlist.
 */
function tempoStat(tracks: readonly Track[]): string {
  const known = tracks
    .map((track) => track.bpm)
    .filter((bpm): bpm is number => typeof bpm === 'number' && bpm > 0)
    .sort((a, b) => a - b);

  if (known.length === 0) return '—';
  return known.length === tracks.length
    ? `${median(known)} BPM`
    : `${median(known)} BPM (${known.length}/${tracks.length})`;
}

/**
 * How many of the eleven bands the playlist reaches. This replaced a range of
 * luminance values: lightness now only orders covers inside a band, so the span
 * that describes a sequence is how much of the spectrum it actually touches.
 */
function spreadStat(tracks: readonly Track[]): string {
  const bands = new Set<number>();
  for (const track of tracks) {
    bands.add(bandIndex(track.hue, track.lightness ?? 0));
  }
  return `${bands.size}/${BANDS.length}`;
}

/** Read-out for a finished sequence. */
export function sequenceStats(tracks: readonly Track[]): Stat[] {
  const hues = tracks
    .map((track) => track.hue)
    .filter((hue): hue is number => typeof hue === 'number');
  const dominant = meanHue(hues);

  return [
    { label: 'Items', value: String(tracks.length) },
    { label: 'Bands', value: tracks.length === 0 ? '—' : spreadStat(tracks) },
    { label: 'Tempo', value: tempoStat(tracks) },
    { label: 'Dominant hue', value: dominant === null ? '—' : `${dominant}°` },
  ];
}
