import 'server-only';

import { NodeImage } from '@vibrant/image-node';

import { linearToHex, linearToOklab, oklabToLinear, oklchHue, toLinear } from '@/lib/color';

const TIMEOUT_MS = 8000;
/** Guards against a mislabelled URL pulling something huge into memory. */
const MAX_BYTES = 4 * 1024 * 1024;
/** 4096 pixels describe a cover's colour make-up as well as the full image. */
const SAMPLE_SIZE = 64;

/**
 * OKLab chroma below which a pixel carries no usable hue. Blacks, whites and
 * greys sit here, and letting them vote would swing the hue arbitrarily.
 */
const NEUTRAL_CHROMA = 0.045;
/** A cover with fewer coloured pixels than this has no hue of its own. */
const NEUTRAL_SHARE = 0.12;
const CLUSTERS = 6;
const REFINEMENTS = 8;

export interface CoverColour {
  /** The dominant chromatic colour, or the average when the cover is neutral. */
  color: string;
  /** OKLCH hue in degrees, `null` when the cover is neutral. */
  hue: number | null;
  /**
   * OKLab lightness of `color` — the dominant cluster's own, or the image mean
   * when the cover is neutral. Orders covers inside a band, so the ribbon under
   * the artwork runs dark to light in step with the sequence.
   */
  lightness: number;
}

interface Pixel {
  L: number;
  a: number;
  b: number;
}

/** Pulls chroma in until OKLab lands back inside sRGB, keeping hue and lightness. */
function toHex(L: number, a: number, b: number): string {
  let scale = 1;
  for (let i = 0; i < 24; i += 1) {
    const [r, g, blue] = oklabToLinear(L, a * scale, b * scale);
    if ([r, g, blue].every((v) => v >= -0.001 && v <= 1.001)) break;
    scale *= 0.92;
  }
  const [r, g, blue] = oklabToLinear(L, a * scale, b * scale);
  return linearToHex(r, g, blue);
}

/**
 * Groups the coloured pixels and returns the largest group's centre.
 *
 * Seeded from a coarse histogram rather than at random, so the same cover
 * always produces the same colour — a sequence that reshuffled itself between
 * runs would be worse than one that is merely imperfect.
 */
function dominantCluster(pixels: Pixel[]): Pixel {
  const key = (p: Pixel) =>
    `${Math.floor(p.L * 6)}:${Math.floor((p.a + 0.4) * 12)}:${Math.floor((p.b + 0.4) * 12)}`;
  const buckets = new Map<string, Pixel[]>();
  for (const pixel of pixels) {
    const bucket = buckets.get(key(pixel));
    if (bucket) bucket.push(pixel);
    else buckets.set(key(pixel), [pixel]);
  }

  const centre = (group: Pixel[]): Pixel => ({
    L: group.reduce((sum, p) => sum + p.L, 0) / group.length,
    a: group.reduce((sum, p) => sum + p.a, 0) / group.length,
    b: group.reduce((sum, p) => sum + p.b, 0) / group.length,
  });

  let centroids = [...buckets.values()]
    .sort((x, y) => y.length - x.length)
    .slice(0, CLUSTERS)
    .map(centre);

  let groups: Pixel[][] = [];
  for (let round = 0; round < REFINEMENTS; round += 1) {
    groups = centroids.map(() => []);
    for (const pixel of pixels) {
      let best = 0;
      let bestDistance = Infinity;
      centroids.forEach((c, i) => {
        const distance = (c.L - pixel.L) ** 2 + (c.a - pixel.a) ** 2 + (c.b - pixel.b) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });
      groups[best].push(pixel);
    }
    const moved = groups.filter((g) => g.length > 0);
    if (moved.length === 0) break;
    centroids = moved.map(centre);
  }

  const largest = groups.reduce((a, b) => (b.length > a.length ? b : a), groups[0] ?? []);
  return largest.length > 0 ? centre(largest) : pixels[0];
}

/**
 * The colour a cover is ordered by.
 *
 * The hue is the dominant *chromatic* cluster, not the average: a sleeve with a
 * blue field and a large red face averages to a dusty mauve that appears
 * nowhere in the image, and averaging is what made two obviously blue covers
 * land in different halves of the grid.
 *
 * Lightness is read off the same colour that is shown: a band sorted by the
 * image mean would put covers in an order its own colour chips contradict.
 */
export async function coverColour(url: string): Promise<CoverColour | null> {
  let buffer: Buffer;
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;
    buffer = Buffer.from(bytes);
  } catch {
    return null;
  }

  try {
    const image = new NodeImage();
    await image.load(buffer);
    image.resize(SAMPLE_SIZE, SAMPLE_SIZE, 1);
    const { data } = image.getImageData();

    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let total = 0;
    const chromatic: Pixel[] = [];

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const r = toLinear(data[i] / 255);
      const g = toLinear(data[i + 1] / 255);
      const b = toLinear(data[i + 2] / 255);
      sumR += r;
      sumG += g;
      sumB += b;
      total += 1;

      const [L, A, B] = linearToOklab(r, g, b);
      if (Math.hypot(A, B) >= NEUTRAL_CHROMA) chromatic.push({ L, a: A, b: B });
    }
    if (total === 0) return null;

    const mean = { r: sumR / total, g: sumG / total, b: sumB / total };

    // Mostly black, white or grey: no hue worth ordering by, so the image mean
    // is both the colour to show and the lightness that places it.
    if (chromatic.length / total < NEUTRAL_SHARE) {
      const [lightness] = linearToOklab(mean.r, mean.g, mean.b);
      return { color: linearToHex(mean.r, mean.g, mean.b), hue: null, lightness };
    }

    const dominant = dominantCluster(chromatic);
    return {
      // Shown at the cluster's own lightness, so the hex names a colour that is
      // actually in the picture above it.
      color: toHex(dominant.L, dominant.a, dominant.b),
      hue: oklchHue(dominant.a, dominant.b),
      lightness: dominant.L,
    };
  } catch {
    return null;
  }
}
