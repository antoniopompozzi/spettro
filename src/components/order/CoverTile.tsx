'use client';

import type { SequencedTrack } from '@/lib/types';

import styles from './CoverTile.module.css';

interface CoverTileProps {
  track: SequencedTrack;
  /** False while the cover is still being read: only the blank plate shows. */
  loaded: boolean;
}

/**
 * One cover in the sequence.
 *
 * Spotify's design guidelines forbid overlaying, cropping, animating or
 * distorting album art, so nothing is drawn on top of the image: the index and
 * the hex sit on a technical row underneath it, and the only interactive
 * element is the title, which links out to the track on Spotify.
 *
 * The extracted colour is painted behind the artwork rather than replaced by
 * it. The grid shows its gradient the moment a sequence lands, each cover
 * settles onto the colour it produced, and a track whose art fails to load
 * simply keeps the colour — a fallback rather than a hole.
 */
export function CoverTile({ track, loaded }: CoverTileProps) {
  const index = String(track.position + 1).padStart(2, '0');
  const tempo = track.bpm == null ? '—' : `${track.bpm} BPM`;

  return (
    <div className={`${styles.tile} ${loaded ? styles.revealing : styles.pending}`}>
      {/* Square art in a square frame: object-fit never has anything to crop. */}
      <span className={styles.plate}>
        <span
          className={styles.wash}
          style={loaded ? { background: track.color } : undefined}
          aria-hidden="true"
        />
        {loaded && track.coverUrl ? (
          // The cover is the content here, not decoration: it is the thing the
          // whole sequence is built from, so it is named by the release it
          // belongs to rather than announced as "image". Width and height are
          // the artwork's own square, which reserves the space before it
          // decodes; CSS still sizes it to the column.
          <img
            className={styles.art}
            src={track.coverUrl}
            alt={`Album art for ${track.title} by ${track.artist}`}
            width={300}
            height={300}
            loading="lazy"
            decoding="async"
          />
        ) : null}
      </span>

      {/*
        * The ribbon: the extracted colour restated at a fixed height, beside the
        * artwork rather than on it. The covers alone do not read as a
        * progression — each one is busy in its own way — so this carries the
        * gradient across the rows where the eye can follow it.
        */}
      <span
        className={styles.band}
        style={loaded ? { background: track.color } : undefined}
        aria-hidden="true"
      />

      <span className={`${styles.tech} mono`}>
        <span>{index}</span>
        <span className={styles.hex}>{loaded ? track.color : ''}</span>
      </span>

      <span className={styles.title}>
        {loaded && track.spotifyUrl ? (
          <a
            className={styles.link}
            href={track.spotifyUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`${track.title} by ${track.artist} — Play on Spotify`}
          >
            {track.title}
          </a>
        ) : (
          track.title
        )}
      </span>
      <span className={styles.artist}>{track.artist}</span>

      <span className={`${styles.meta} mono`}>
        <span>{loaded ? tempo : ''}</span>
        {loaded && track.explicit ? (
          // A lone "E" is a convention the eye knows and a screen reader does
          // not: read out, it is the letter and nothing else. The letter is
          // hidden from assistive tech and the words are given instead.
          <span className={styles.explicit}>
            <span aria-hidden="true">E</span>
            <span className="srOnly">Explicit content</span>
          </span>
        ) : null}
      </span>
    </div>
  );
}
