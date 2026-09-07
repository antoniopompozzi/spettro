import type { Recommendation } from '@/lib/types';

/**
 * Stand-in catalogue for Discover, which is still offline. Order runs on real
 * Spotify, ReccoBeats and cover-colour data through `/api/order`.
 */
const RECOMMENDATIONS: ReadonlyArray<
  readonly [title: string, artist: string, bpm: number, color: string]
> = [
  ['Dust and Neon', 'Nadia Volk', 92, '#5A1B14'],
  ['Radio Silence Hill', 'Corvo', 104, '#8A3A12'],
  ['Second Shift', 'Delia Sang', 118, '#B9821B'],
  ['Long Exposure', 'Ari Petrov', 126, '#C2B32A'],
  ['Harbour Fog', 'Tomas Kir', 134, '#3E8F3C'],
  ['Cold Channel', 'Anouk Frey', 140, '#1B6E74'],
  ['Sleeper Car', 'Kaspar Lind', 148, '#1F4E96'],
  ['Halide', 'Tess Morrow', 156, '#4A2E86'],
];

export function mockRecommendations(): Recommendation[] {
  return RECOMMENDATIONS.map(([title, artist, bpm, color], i) => ({
    id: `rec-${i}`,
    title,
    artist,
    bpm,
    color,
  }));
}

/** BPM range the Discover result bars are drawn against. */
export const BPM_RANGE = { min: 80, max: 170 } as const;
