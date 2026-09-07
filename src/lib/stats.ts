import { dominantHue } from '@/lib/color';
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

/** Read-out for a finished sequence. */
export function sequenceStats(tracks: readonly Track[]): Stat[] {
  const first = tracks[0];
  const last = tracks[tracks.length - 1];

  return [
    { label: 'Items', value: String(tracks.length) },
    {
      label: 'Lum_range',
      value: first && last ? `${first.color} — ${last.color}` : '—',
    },
    { label: 'Tempo', value: tempoStat(tracks) },
    {
      label: 'Dominant hue',
      value: `${dominantHue(tracks.map((track) => track.color))}°`,
    },
  ];
}
