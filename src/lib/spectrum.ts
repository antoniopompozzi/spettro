/**
 * The order the grid walks: eleven named bands, fixed, achromatic first.
 *
 * Bands are a declared list rather than equal slices of the hue wheel. A wheel
 * has to be cut somewhere, and whatever sits astride the cut gets torn into two
 * groups at opposite ends of the grid — which is what happened to the reds,
 * with a crimson sleeve at 22 degrees landing a whole grid away from a scarlet
 * one at 29. Here the cut falls between pink and red, where the sequence ends
 * anyway, and every band's range is chosen around the colour it is named for.
 *
 * Shared: the API orders by this and the read-out counts by it, so there is one
 * definition of where a band begins.
 */

export const BANDS = [
  'black',
  'grey',
  'white',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'indigo',
  'violet',
  'pink',
] as const;

export type Band = (typeof BANDS)[number];

/** Where the wheel is cut, between pink and red, so red stays in one piece. */
export const HUE_CUT = 13;

/**
 * OKLCH hue ranges, start inclusive, end exclusive, in degrees. Tuning knobs:
 * these are perceptual judgements, not derived values.
 *
 * Anchors measured in OKLCH: red 29, orange 53, gold 95, yellow 110, green 142,
 * turquoise 185, cyan 195, sky 226, blue 264, indigo 302, purple 328, pink 352.
 *
 * Two ranges are deliberately lopsided. Green runs to 205 so turquoise and cyan
 * fall inside it rather than drifting into blue. Indigo is narrow because OKLCH
 * puts indigo and blue-violet within a degree of each other — they part on
 * lightness, not hue — so the split between indigo and violet is a convention,
 * placed to keep classic indigo out of the violet band.
 *
 * Yellow ends at 120 rather than the midpoint between its anchor and green's.
 * A dark olive sits around 121, and at 125 it stayed in yellow — where, being
 * far darker than everything else there, the sort inside the band put it first
 * and it read as a patch of green between two runs of gold. This is the same
 * kind of limit as the indigo split above: at one hue a light colour reads
 * cream and a dark one reads olive, and a boundary drawn on hue alone cannot
 * tell them apart. Moving it is a convention that fixes the case that turned
 * up, not the class of case.
 */
export const HUE_RANGES: Readonly<Record<Exclude<Band, 'black' | 'grey' | 'white'>, readonly [number, number]>> = {
  red: [13, 42],
  orange: [42, 90],
  yellow: [90, 120],
  green: [120, 205],
  blue: [205, 282],
  indigo: [282, 305],
  violet: [305, 330],
  // Runs past 360 and back to the cut: pink is the band the wheel closes on.
  pink: [330, 373],
};

/** OKLab lightness splitting the three achromatic bands. Tuning knobs. */
export const BLACK_MAX_LIGHTNESS = 0.35;
export const WHITE_MIN_LIGHTNESS = 0.72;

const rotate = (degrees: number) => (((degrees - HUE_CUT) % 360) + 360) % 360;

/**
 * The band a cover belongs to, as an index into `BANDS` — which is also its
 * rank in the sequence. A cover with no hue is placed by lightness alone.
 */
export function bandIndex(hue: number | null | undefined, lightness: number): number {
  if (hue === null || hue === undefined) {
    if (lightness < BLACK_MAX_LIGHTNESS) return BANDS.indexOf('black');
    return BANDS.indexOf(lightness >= WHITE_MIN_LIGHTNESS ? 'white' : 'grey');
  }
  const turned = rotate(hue);
  for (const [name, [start, end]] of Object.entries(HUE_RANGES)) {
    if (turned >= rotate(start) && turned < rotate(start) + (end - start)) {
      return BANDS.indexOf(name as Band);
    }
  }
  // Unreachable while the ranges tile the wheel; pink closes it if one is off.
  return BANDS.indexOf('pink');
}

export const bandName = (index: number): Band => BANDS[index] ?? 'pink';
