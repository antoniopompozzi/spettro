import { meanHue } from '@/lib/color';
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
 *
 * The tally used to sit in brackets on the same line as the BPM, where it read
 * as part of the figure. It is a second line now, smaller: the number is what
 * the card is for, and how many tracks it speaks for is a footnote to it.
 */
function tempoStat(tracks: readonly Track[]): Pick<Stat, 'value' | 'detail' | 'detailLabel'> {
  const known = tracks
    .map((track) => track.bpm)
    .filter((bpm): bpm is number => typeof bpm === 'number' && bpm > 0)
    .sort((a, b) => a - b);

  if (known.length === 0) return { value: '—' };
  if (known.length === tracks.length) return { value: `${median(known)} BPM` };
  return {
    value: `${median(known)} BPM`,
    detail: `${known.length}/${tracks.length}`,
    detailLabel: `from ${known.length} of ${tracks.length} tracks`,
  };
}

/**
 * Read-out for a finished sequence.
 *
 * `dropped` counts tracks whose artwork could not be read, and it appears
 * only when it is not zero. On a healthy run there is nothing to say and the
 * panel keeps its three figures; when Spotify's CDN is slow enough to cost
 * covers, the number that explains a short grid is on screen instead of
 * buried in the API response.
 *
 * There was a fourth figure, `Bands`, counting how many of the eleven the
 * sequence reached. It was dropped: the grid already shows the spread by being
 * the spread, and the number needed the band list explained before it meant
 * anything.
 */
export function sequenceStats(tracks: readonly Track[], dropped = 0): Stat[] {
  const hues = tracks
    .map((track) => track.hue)
    .filter((hue): hue is number => typeof hue === 'number');
  const dominant = meanHue(hues);

  return [
    { label: 'Items', value: String(tracks.length) },
    { label: 'Avg tempo', ...tempoStat(tracks) },
    {
      label: 'Dominant hue',
      value: dominant === null ? '—' : `${dominant}°`,
      ...(dominant === null ? {} : { swatchHue: dominant }),
    },
    ...(dropped > 0 ? [{ label: 'Covers unread', value: String(dropped) }] : []),
  ];
}
