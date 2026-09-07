'use client';

import { contrastInk } from '@/lib/color';
import type { SequencedTrack } from '@/lib/types';

import styles from './CoverTile.module.css';

interface CoverTileProps {
  track: SequencedTrack;
  /** False while the cover is still being read: the plate stays blank. */
  loaded: boolean;
  /** Tapped open, which pins the hex label on touch devices. */
  open: boolean;
  onToggle: () => void;
}

export function CoverTile({ track, loaded, open, onToggle }: CoverTileProps) {
  const index = String(track.position + 1).padStart(2, '0');
  const className = [
    styles.tile,
    loaded ? styles.revealing : styles.pending,
    open ? styles.open : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      onClick={onToggle}
      aria-expanded={open}
      aria-label={
        loaded
          ? `${index}. ${track.title} by ${track.artist}, ${track.color}`
          : `${index}. Reading cover`
      }
    >
      <span
        className={styles.plate}
        style={
          loaded
            ? { background: track.color, ['--ink' as string]: contrastInk(track.color) }
            : undefined
        }
      >
        <span className={`${styles.index} mono`} aria-hidden="true">
          {index}
        </span>
        {loaded ? (
          <span className={`${styles.hex} mono`} aria-hidden="true">
            {track.color}
          </span>
        ) : null}
      </span>
      <span className={styles.title} aria-hidden="true">
        {loaded ? track.title : '—'}
      </span>
      <span className={styles.artist} aria-hidden="true">
        {loaded ? track.artist : '—'}
      </span>
    </button>
  );
}
