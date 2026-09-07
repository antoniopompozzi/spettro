import { dominantHue } from '@/lib/color';
import type { Stat, Track } from '@/lib/types';

/**
 * Read-out for a finished sequence. Tempo is still a placeholder — it needs the
 * audio features that arrive with the Spotify/Deezer integration.
 */
export function sequenceStats(tracks: readonly Track[]): Stat[] {
  const first = tracks[0];
  const last = tracks[tracks.length - 1];

  return [
    { label: 'Items', value: String(tracks.length) },
    {
      label: 'Lum_range',
      value: first && last ? `${first.color} — ${last.color}` : '—',
    },
    { label: 'Tempo', value: '118 BPM' },
    {
      label: 'Dominant hue',
      value: `${dominantHue(tracks.map((track) => track.color))}°`,
    },
  ];
}
