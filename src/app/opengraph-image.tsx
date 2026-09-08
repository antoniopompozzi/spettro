import { ImageResponse } from 'next/og';

export const alt = 'Spettro — reorder a playlist along the colour of its covers';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * The link preview, drawn rather than screenshotted.
 *
 * A screenshot of the grid would be a picture of somebody's playlist, which
 * is both the wrong thing to publish and a different image every time it is
 * taken. This is the identity instead: the CRT green on the near-black
 * ground, the scanlines the wordmark wears in the app, and the eleven bands
 * the sequence walks through — which say what the app does without needing a
 * caption to explain the picture.
 *
 * The scanlines are individual rows rather than a repeating gradient because
 * the renderer behind `ImageResponse` supports only a subset of CSS, and a
 * stack of plain divs is the part of it that cannot be got wrong.
 */
const BG = '#141414';
const GREEN = '#43ec44';
const DIM = '#8a857c';

/** The eleven bands, in the order the grid walks them (`src/lib/spectrum.ts`). */
const BANDS = [
  '#1a1a1a',
  '#6e6a63',
  '#f2efe6',
  '#e2483f',
  '#e07a2c',
  '#e8c135',
  '#4fb254',
  '#3d8fd1',
  '#5257c4',
  '#8b4fc0',
  '#d45a9a',
];

const SCANLINE_STEP = 6;

export default function Image() {
  const scanlines = Array.from({ length: Math.floor(size.height / SCANLINE_STEP) }, (_, i) => (
    <div
      key={i}
      style={{
        position: 'absolute',
        left: 0,
        top: i * SCANLINE_STEP,
        width: size.width,
        height: 2,
        background: '#000000',
        opacity: 0.22,
      }}
    />
  ));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: BG,
          position: 'relative',
        }}
      >
        <div
          style={{
            fontSize: 150,
            fontWeight: 800,
            letterSpacing: 18,
            color: GREEN,
            display: 'flex',
          }}
        >
          SPETTRO
        </div>

        <div
          style={{
            marginTop: 28,
            fontSize: 34,
            color: DIM,
            letterSpacing: 1,
            display: 'flex',
          }}
        >
          Reorder a playlist along the colour of its covers
        </div>

        <div style={{ display: 'flex', marginTop: 64 }}>
          {BANDS.map((colour) => (
            <div
              key={colour}
              style={{
                width: 68,
                height: 68,
                borderRadius: 8,
                background: colour,
                marginLeft: 10,
                // The black band is a colour here, not an absence. Without an
                // edge it reads as a hole in the strip against this ground.
                border: '1px solid rgba(242, 239, 230, 0.14)',
              }}
            />
          ))}
        </div>

        {scanlines}
      </div>
    ),
    size,
  );
}
