'use client';

import { useMemo } from 'react';

import { useGridColumns } from '@/hooks/useMediaQuery';
import type { SequencedTrack, Track } from '@/lib/types';

import { CoverTile } from './CoverTile';
import styles from './SpectrumGrid.module.css';

interface SpectrumGridProps {
  tracks: readonly Track[];
  /** Ids whose colour is known. `null` means the whole sequence is settled. */
  revealed: ReadonlySet<string> | null;
}

/**
 * Covers laid out boustrophedon: left to right, then right to left, with an
 * arrow marking each turn so the reading order stays obvious.
 */
export function SpectrumGrid({ tracks, revealed }: SpectrumGridProps) {
  const columns = useGridColumns();

  const rows = useMemo(() => {
    const sequenced: SequencedTrack[] = tracks.map((track, position) => ({
      ...track,
      position,
    }));
    // Every row keeps the sequence's own order. The turn is drawn by CSS on
    // the odd rows, so the DOM stays the order the sequence is meant to be
    // read in — which is the order Tab walks and a screen reader announces.
    // Reversing the array instead made the keyboard jump from the end of one
    // row to the far side of the next and walk back, against the arrow.
    const chunks: SequencedTrack[][] = [];
    for (let i = 0; i < sequenced.length; i += columns) {
      chunks.push(sequenced.slice(i, i + columns));
    }
    return chunks;
  }, [columns, tracks]);

  return (
    <section aria-label="Spectrum sequence" style={{ ['--cover-cols' as string]: columns }}>
      {rows.map((row, index) => {
        // The turn sits at the end of the row just read: right after a
        // left-to-right row, left after a right-to-left one. It points the
        // way the next row runs, so it aims back across the grid.
        const turnAtRight = index % 2 === 0;
        return (
          <div key={row[0]?.id ?? index}>
            <div className={`${styles.row} ${turnAtRight ? '' : styles.reversed}`}>
              {row.map((track) => (
                <CoverTile
                  key={track.id}
                  track={track}
                  loaded={revealed === null || revealed.has(track.id)}
                />
              ))}
            </div>
            {index < rows.length - 1 ? (
              <div
                className={`${styles.turn} ${turnAtRight ? styles.right : styles.left}`}
                aria-hidden="true"
              >
                <span
                  className={`${styles.arrow} ${
                    turnAtRight ? styles.downLeft : styles.downRight
                  } scanlines mono`}
                >
                  {turnAtRight ? '↙' : '↘'}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
