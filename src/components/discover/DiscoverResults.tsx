import type { Suggestion } from '@/lib/types';

import styles from './DiscoverResults.module.css';

/**
 * The tempo range the bars are drawn against.
 *
 * A bar has to be proportional to something, and tempo has no natural ceiling
 * to divide by. These are the bounds most recorded music falls between, so the
 * bar spends its length on the differences that exist rather than compressing
 * every track into the bottom third of a scale that reaches nowhere. Tracks
 * outside the range are clamped: the bar is a comparison between the rows on
 * screen, not a measurement to read a number off — the number is printed above
 * it, unrounded and unnormalised.
 */
const BPM_RANGE = { min: 80, max: 170 } as const;

/**
 * The shortest bar a measured tempo may draw.
 *
 * Clamping alone puts anything at or below the floor at zero width, which draws
 * nothing — and nothing is what a track with no tempo at all draws. A 77 BPM
 * reading would then look exactly like an absent one, which is the distinction
 * this whole column exists to keep. So a tempo that exists always leaves a mark,
 * however slow.
 *
 * Five per cent, because the rail it sits on is 86px wide, which makes this
 * 4.3px: short enough to read as the bottom of the scale, wide enough to read
 * as something. Two per cent was the first guess and is 1.7px, which is a mark
 * nobody sees — the same failure one step smaller.
 */
const MIN_BAR_SHARE = 5;

/** Position of a tempo inside the display range, as a 5–100 percentage. */
function bpmShare(bpm: number): number {
  const span = BPM_RANGE.max - BPM_RANGE.min;
  const share = ((bpm - BPM_RANGE.min) / span) * 100;
  return Math.max(MIN_BAR_SHARE, Math.min(100, Math.round(share)));
}

/**
 * The suggestions, one row each.
 *
 * The square on the left is the album art. It used to be a plate of the colour
 * Spettro read off that art, on the reasoning that showing the art small would
 * be cropping and overlaying it — which was simply wrong: Spotify's guidelines
 * forbid altering artwork, and a square cover in a square box at 56px is
 * neither cropped nor covered. It is the same picture, smaller. The extracted
 * colour has not gone anywhere; it still decides the ranking, it is just no
 * longer standing in for the thing it was read from.
 *
 * That colour is now painted behind the image rather than instead of it, so a
 * cover that fails to load leaves the row with a colour instead of a hole —
 * the same fallback the grid uses.
 *
 * The title is the link out, as it is in the grid. A track with no tempo shows
 * an em dash and no bar: ReccoBeats has no reading for a fair share of any
 * catalogue, and a zero-width bar at the left of the scale would be a claim
 * that the track is slow rather than unmeasured.
 */
export function DiscoverResults({ items }: { items: readonly Suggestion[] }) {
  return (
    <section className={styles.list} aria-label="Results">
      {items.map((item) => (
        <article key={item.id} className={styles.row}>
          <div
            className={styles.cover}
            style={{ background: item.color }}
            // Only decorative while it is standing in for a cover that is not
            // there; with the image on top, the image carries the meaning.
            aria-hidden={item.coverUrl ? undefined : true}
          >
            {item.coverUrl ? (
              // Square art in a square frame, so `object-fit` never has
              // anything to crop. The dimensions are the rendered ones, which
              // reserves the row's height before the image decodes.
              // eslint-disable-next-line @next/next/no-img-element -- fixed 56px thumbnail
              <img
                className={styles.art}
                src={item.coverUrl}
                alt={`Album art for ${item.title} by ${item.artist}`}
                width={56}
                height={56}
                loading="lazy"
                decoding="async"
              />
            ) : null}
          </div>
          <div className={styles.meta}>
            <div className={styles.title}>
              {item.spotifyUrl ? (
                <a
                  className={styles.link}
                  href={item.spotifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${item.title} by ${item.artist} — Play on Spotify`}
                >
                  {item.title}
                </a>
              ) : (
                item.title
              )}
            </div>
            <div className={styles.artist}>
              <span>{item.artist}</span>
              {item.explicit ? (
                // A lone "E" is a convention the eye knows and a screen reader
                // does not: read out, it is the letter and nothing else.
                <span className={styles.explicit}>
                  <span aria-hidden="true">E</span>
                  <span className="srOnly">Explicit content</span>
                </span>
              ) : null}
            </div>
          </div>
          <div className={styles.tempo}>
            <div className={`${styles.bpm} mono`}>
              {item.bpm === null || item.bpm === undefined ? (
                <>
                  <span aria-hidden="true">—</span>
                  <span className="srOnly">Tempo unknown</span>
                </>
              ) : (
                <>
                  {item.bpm}
                  <span className="srOnly"> BPM</span>
                </>
              )}
            </div>
            <div className={styles.track} aria-hidden="true">
              {item.bpm === null || item.bpm === undefined ? null : (
                <div className={styles.bar} style={{ width: `${bpmShare(item.bpm)}%` }} />
              )}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
