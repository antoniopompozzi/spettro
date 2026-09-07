import { hslToHex } from '@/lib/color';
import type { Recommendation, Track } from '@/lib/types';

/**
 * Stand-in catalogue. Nothing here touches the network: the whole interface is
 * navigable before Spotify, Deezer or Last.fm are wired up.
 */
const TITLES: ReadonlyArray<readonly [title: string, artist: string]> = [
  ['Ember Hours', 'Nadia Volk'],
  ['Low Tide Static', 'Corvo'],
  ['Blackout Motel', 'The Pale Signal'],
  ['Iron Rain', 'Halvard'],
  ['Copper Wire', 'Sena Marlowe'],
  ['Rust Belt Sunday', 'Foxhole Choir'],
  ['Warm Front', 'Delia Sang'],
  ['Slow Amber', 'Tinman Radio'],
  ['Paper Lanterns', 'Yuki Brandt'],
  ['Saffron Lot', 'The Long Way Down'],
  ['Golden Hour Freight', 'Ari Petrov'],
  ['Beeswax', 'Mona Lisk'],
  ['Field of Rye', 'Skovgaard'],
  ['Meadow Signal', 'Cassia Bloom'],
  ['Green Room', 'Ilan Reyes'],
  ['Fern Alphabet', 'Nordwest'],
  ['Moss Letter', 'Halcyon Fig'],
  ['Cold Spring', 'Vera Ito'],
  ['Sea Glass', 'Rhodes & Perl'],
  ['Harbour Lights Out', 'Tomas Kir'],
  ['Deep Channel', 'Anouk Frey'],
  ['Blue Ridge Line', 'The Quiet Fleet'],
  ['Night Ferry', 'Sela Okoye'],
  ['Cobalt Letter', 'Mirren'],
  ['Indigo Tape', 'Juno Sabat'],
  ['Violet Sleeper', 'Kaspar Lind'],
  ['Lilac Interior', 'Nour Bahri'],
  ['Orchid Static', 'Sable Ten'],
  ['Magenta Weather', 'Ivy Kolar'],
  ['Rose Static', 'The Frayed Ends'],
  ['Ash Blossom', 'Petra Vane'],
  ['Salt Print', 'Odd Lumen'],
  ['Concrete Garden', 'Bram Elias'],
  ['Grey Market', 'Nils Auber'],
  ['Silver Halide', 'Tess Morrow'],
  ['Winter Linen', 'Adélie'],
  ['Chalk Line', 'Rune Sandt'],
  ['Bone China', 'Mira Ostrow'],
  ['Snow Blind', 'Cal Ferrier'],
  ['Overexposed', 'Hana Wilde'],
  ['Milk Glass', 'Osian Grey'],
  ['White Noise Sunday', 'Lucia Ferrand'],
  ['Bleached Film', 'Tomo Ridge'],
  ['Last Light Meter', 'Erika Solano'],
  ['Full Spectrum', 'Peregrine Nine'],
];

export const DEFAULT_TRACK_COUNT = 42;

/**
 * The sequenced playlist: `count` tracks whose cover colours sweep the spectrum
 * from dark to light, which is the shape a real Order run will produce.
 */
export function mockSequence(count = DEFAULT_TRACK_COUNT): Track[] {
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1);
    const neutral = i % 7 === 5;
    const [title, artist] = TITLES[i % TITLES.length];
    return {
      id: `mock-${i}`,
      title,
      artist,
      color: hslToHex(
        8 + t * 322,
        neutral ? 5 : 62 - Math.sin(t * Math.PI) * 14,
        11 + t * 74,
      ),
    };
  });
}

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
