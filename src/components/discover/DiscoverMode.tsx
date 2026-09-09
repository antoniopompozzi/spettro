'use client';

import { useCallback, useEffect, useState } from 'react';

import { ScanBar } from '@/components/ScanBar';
import { SpotifyAttribution } from '@/components/SpotifyAttribution';
import { FormError } from '@/components/ui/FormError';
import { useDiscover } from '@/hooks/useDiscover';
import type { DiscoverSeed, Seed } from '@/lib/types';

import { DiscoverEmpty } from './DiscoverEmpty';
import { DiscoverResults } from './DiscoverResults';
import styles from './DiscoverMode.module.css';
import { SeedSlots } from './SeedSlots';

const EMPTY_SEEDS: Seed[] = [null, null, null];

const NOT_CONNECTED =
  'Connect your Spotify account under Order first — Spettro searches Spotify as you.';

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
  const [connected, setConnected] = useState<boolean | null>(null);
  const { phase, results, error, setError, start } = useDiscover();

  const filled = seeds.filter((seed): seed is NonNullable<Seed> => Boolean(seed));

  // Discover reaches Spotify as the listener for the same reason Order does:
  // this app has no client secret, so the catalogue is searched with the user's
  // own token or not at all.
  useEffect(() => {
    void fetch('/api/spotify/session', { cache: 'no-store' })
      .then((response) => response.json() as Promise<{ connected: boolean }>)
      .then((session) => setConnected(session.connected))
      .catch(() => setConnected(false));
  }, []);

  const writeSlot = (index: number, seed: Seed) => {
    setSeeds((current) => current.map((existing, i) => (i === index ? seed : existing)));
    setError(null);
  };

  const find = useCallback(() => {
    if (connected === false) {
      setError(NOT_CONNECTED);
      return;
    }
    // A slot holds a title and nothing else today. The API takes an artist and
    // a Spotify id alongside it when a pick carries them, and resolves the bare
    // title against Spotify when it does not — so this passes what it has.
    const given: DiscoverSeed[] = filled.map((seed) => ({ title: seed.title }));
    void start(given);
  }, [connected, filled, setError, start]);

  const searching = phase === 'searching';

  return (
    <div className={styles.stack}>
      <ScanBar active={searching} label="Reading covers" />

      <SeedSlots
        seeds={seeds}
        onType={(index, title) => writeSlot(index, title ? { title } : null)}
        onClear={(index) => writeSlot(index, null)}
      />

      <div className={styles.cta}>
        <button
          type="button"
          className={styles.find}
          disabled={filled.length === 0 || searching}
          onClick={find}
        >
          {searching ? 'Finding' : 'Find'}
        </button>
        <p className={styles.hint}>{hintFor(filled.length)}</p>
      </div>

      <FormError id="discover-error">{error}</FormError>

      {phase === 'empty' ? <DiscoverEmpty /> : null}
      {/* Wherever Spotify's metadata shows, so does its mark. */}
      {phase === 'results' ? (
        <>
          <SpotifyAttribution label="Track data and cover colours" />
          <DiscoverResults items={results} />
        </>
      ) : null}
    </div>
  );
}
