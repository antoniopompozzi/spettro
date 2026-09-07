'use client';

import { useId } from 'react';

import type { Seed } from '@/lib/types';

import styles from './SeedSlots.module.css';

const LABELS = ['Song 1', 'Song 2 (optional)', 'Song 3 (optional)'] as const;

interface SeedSlotsProps {
  seeds: readonly Seed[];
  /** Types a title into a slot; an empty string clears it. */
  onType: (index: number, title: string) => void;
  onClear: (index: number) => void;
}

/** The three seed fields — the only way to set a seed. */
export function SeedSlots({ seeds, onType, onClear }: SeedSlotsProps) {
  const groupId = useId();

  return (
    <section className={styles.slots} aria-label="Seeds">
      {seeds.map((seed, index) => {
        const fieldId = `${groupId}-seed-${index}`;
        return (
          <div key={index} className={`${styles.slot} ${seed ? styles.filled : ''}`}>
            <label className={`${styles.label} mono`} htmlFor={fieldId}>
              {LABELS[index]}
            </label>
            <div className={styles.field}>
              <span className={`${styles.index} mono`} aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <input
                id={fieldId}
                className={styles.input}
                value={seed?.title ?? ''}
                placeholder={index === 0 ? 'Type a song title' : 'Optional'}
                autoComplete="off"
                onChange={(event) => onType(index, event.target.value)}
              />
              {seed ? (
                <button
                  type="button"
                  className={`${styles.clear} mono`}
                  onClick={() => onClear(index)}
                  aria-label={`Clear ${LABELS[index]}`}
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </section>
  );
}
