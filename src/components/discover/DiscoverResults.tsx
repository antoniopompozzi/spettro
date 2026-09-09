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
 */
const MIN_BAR_SHARE = 2;

/** Position of a tempo inside the display range, as a 2–100 percentage. */
function bpmShare(bpm: number): number {
  const span = BPM_RANGE.max - BPM_RANGE.min;
  const share = ((bpm - BPM_RANGE.min) / span) * 100;
  return Math.max(MIN_BAR_SHARE, Math.min(100, Math.round(share)));
}

/**
 * The suggestions, one row each.
 *
 * The plate on the left is the colour Spettro read off the track's artwork —
 * the thing that decided its rank — and not the artwork itself. Spotify's
 * guidelines forbid cropping or overlaying album art, and a 56px square beside
 * a title would be doing both; the colour is Spettro's own reading of it and
 * carries no such rule. The title is the link out, as it is in the grid.
 *
 * A track with no tempo shows an em dash and no bar. ReccoBeats has no reading
 * for a fair share of any catalogue, and a zero-width bar at the left of the
 * scale would be a claim that the track is slow rather than unmeasured.
 */
export function DiscoverResults({ items }: { items: readonly Suggestion[] }) {
  return (
    <section className={styles.list} aria-label="Results">
      {items.map((item) => (
        <article key={item.id} className={styles.row}>
          <div
            className={styles.cover}
            style={{ background: item.color }}
            aria-hidden="true"
          />
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
