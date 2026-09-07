import 'server-only';

import { Vibrant } from 'node-vibrant/node';

const TIMEOUT_MS = 8000;
/** Guards against a mislabelled URL pulling something huge into memory. */
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Scores a swatch by how much of the cover it covers, tilted towards saturated
 * ones: most artwork has a large near-black region that is technically dominant
 * but says nothing about where the cover sits in the spectrum.
 */
function weight(population: number, saturation: number): number {
  return population * (0.35 + saturation);
}

/**
 * The dominant colour of a cover as `#RRGGBB`, or `null` if the image cannot be
 * fetched or holds no usable swatch.
 */
export async function dominantColor(url: string): Promise<string | null> {
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
    const palette = await Vibrant.from(buffer).getPalette();
    let best: string | null = null;
    let bestWeight = -1;
    for (const swatch of Object.values(palette)) {
      if (!swatch) continue;
      const score = weight(swatch.population, swatch.hsl[1]);
      if (score > bestWeight) {
        bestWeight = score;
        best = swatch.hex;
      }
    }
    return best ? best.toUpperCase() : null;
  } catch {
    return null;
  }
}
