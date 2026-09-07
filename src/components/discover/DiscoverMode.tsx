'use client';

import { useMemo, useState } from 'react';

import { mockRecommendations } from '@/lib/mock/tracks';
import type { Seed } from '@/lib/types';

import { DiscoverResults } from './DiscoverResults';
import styles from './DiscoverMode.module.css';
import { SeedSlots } from './SeedSlots';

const EMPTY_SEEDS: Seed[] = [null, null, null];

function hintFor(count: number): string {
  switch (count) {
    case 0:
      return 'Set at least one seed to search. Type up to three song titles.';
    case 1:
      return 'With one seed the results stay close to that track.';
    case 2:
      return 'With two seeds the results sit between them.';
    default:
      return 'With three seeds the results sit between all three.';
  }
}

export function DiscoverMode() {
  const [seeds, setSeeds] = useState<Seed[]>(EMPTY_SEEDS);
  const [searched, setSearched] = useState(false);

  // Mocked for now: the real recommendations arrive with the catalogue API.
  const results = useMemo(() => mockRecommendations(), []);
  const seedCount = seeds.filter(Boolean).length;

  const writeSlot = (index: number, seed: Seed) => {
    setSeeds((current) => current.map((existing, i) => (i === index ? seed : existing)));
  };

  return (
    <div className={styles.stack}>
      <SeedSlots
        seeds={seeds}
        onType={(index, title) => writeSlot(index, title ? { title } : null)}
        onClear={(index) => writeSlot(index, null)}
      />

      <div className={styles.cta}>
        <button
          type="button"
          className={styles.find}
          disabled={seedCount === 0}
          onClick={() => setSearched(true)}
        >
          Find
        </button>
        <p className={styles.hint}>{hintFor(seedCount)}</p>
      </div>

      {searched && seedCount > 0 ? <DiscoverResults items={results} /> : null}
    </div>
  );
}
