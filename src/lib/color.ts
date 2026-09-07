/**
 * Colour helpers. The API route reduces each cover to a mean colour in linear
 * light and sorts the sequence by its OKLab lightness; extraction itself lives
 * in `lib/server/cover`.
 */

/** HSL (h in degrees, s/l in percent) to an uppercase `#RRGGBB` string. */
export function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) =>
    light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const channel = (v: number) =>
    Math.round(255 * v)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(f(0))}${channel(f(8))}${channel(f(4))}`.toUpperCase();
}

/** `#RRGGBB` to its three channels, each 0..1. */
export function hexToRgb(hex: string): [number, number, number] {
  const at = (i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return [at(0), at(1), at(2)];
}

/** An sRGB channel (0..1) to linear light. */
export function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/** Linear light back to an sRGB channel (0..1). */
export function toSrgb(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
}

/** Linear-light RGB, each 0..1, encoded as an uppercase `#RRGGBB`. */
export function linearToHex(r: number, g: number, b: number): string {
  const channel = (v: number) =>
    Math.round(Math.min(1, Math.max(0, toSrgb(v))) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

/**
 * OKLab lightness of `#RRGGBB`, 0 (black) to 1 (white).
 *
 * This is the sort key for the spectrum. WCAG relative luminance measures how
 * much light a colour emits; OKLab's L is built to match how light it *looks*,
 * which is what a listener reads off the grid. The two disagree most on
 * saturated colours — a deep blue and a mid grey can emit the same light and
 * look nothing alike.
 */
export function oklabLightness(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

/** Linear-light RGB (each 0..1) to OKLab `[L, a, b]`. */
export function linearToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab back to linear-light RGB, which may fall outside 0..1. */
export function oklabToLinear(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** The OKLCH hue angle of an OKLab `a`/`b` pair, 0..360 degrees. */
export function oklchHue(a: number, b: number): number {
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
}

/**
 * Circular mean of a set of hue angles. Plain averaging is wrong on a wheel:
 * 350 and 10 degrees average to 180 rather than to 0.
 */
export function meanHue(degrees: readonly number[]): number | null {
  if (degrees.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const degree of degrees) {
    const radians = (degree * Math.PI) / 180;
    x += Math.cos(radians);
    y += Math.sin(radians);
  }
  if (x === 0 && y === 0) return null;
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}
