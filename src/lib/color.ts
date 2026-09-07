/**
 * Colour helpers used by the mock palette and by the UI to decide whether a
 * label sitting on top of a cover should read dark or light.
 *
 * Real cover-colour extraction (node-vibrant) lands in a later step; for now
 * every colour in the app comes from `lib/mock`.
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

/** Relative luminance (WCAG), 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) =>
    v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Hue in degrees, 0..359. */
export function hue(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  return (Math.round(h * 60) + 360) % 360;
}

/**
 * Circular mean of the hues of a set of colours, weighted by saturation so
 * near-greys do not drag the average around.
 */
export function dominantHue(hexes: string[]): number {
  let x = 0;
  let y = 0;
  for (const hex of hexes) {
    const [r, g, b] = hexToRgb(hex);
    const weight = Math.max(r, g, b) - Math.min(r, g, b);
    const rad = (hue(hex) * Math.PI) / 180;
    x += Math.cos(rad) * weight;
    y += Math.sin(rad) * weight;
  }
  if (x === 0 && y === 0) return 0;
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}

/** A readable foreground for text drawn directly on `hex`. */
export function contrastInk(hex: string): string {
  return luminance(hex) > 0.45 ? 'rgba(20, 20, 20, 0.88)' : 'rgba(242, 239, 230, 0.92)';
}
