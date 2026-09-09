'use client';

import { useCallback, useEffect, useState } from 'react';

import { ScanBar } from '@/components/ScanBar';
import { SpotifyAttribution } from '@/components/SpotifyAttribution';
import { FormError } from '@/components/ui/FormError';
import { useDiscover } from '@/hooks/useDiscover';
import type { DiscoverSeed, SeedSlot } from '@/lib/types';

import { DiscoverEmpty } from './DiscoverEmpty';
import { DiscoverResults } from './DiscoverResults';
import styles from './DiscoverMode.module.css';
import { SeedSlots } from './SeedSlots';

const EMPTY_SEEDS: SeedSlot[] = [null, null, null];

const NOT_CONNECTED =
  'Connect your Spotify account under Order first — Spettro searches Spotify as you.';

function hintFor(count: number): string {
  switch (count) {
    case 0:
      return 'Search for a song and pick it from the list. Up to three.';
    case 1:
      return 'With one seed the results stay close to that track.';
    case 2:
      return 'With two seeds the results sit between them.';
    default:
      return 'With three seeds the results sit between all three.';
  }
}

export function DiscoverMode({ active }: { active: boolean }) {
  const [seeds, setSeeds] = useState<SeedSlot[]>(EMPTY_SEEDS);
  const [connected, setConnected] = useState<boolean | null>(null);
  const { phase, results, error, setError, start, reset } = useDiscover();

  const filled = seeds.filter((seed): seed is NonNullable<SeedSlot> => Boolean(seed));

  // Discover reaches Spotify as the listener for the same reason Order does:
  // this app has no client secret, so the catalogue is searched with the user's
  // own token or not at all.
  //
  // Re-read every time this becomes the visible panel, because the connect
  // control is in Order: a disconnect always happens while Discover is off
  // screen. Suggestions are built from a listener's own account and go with the
  // session, exactly as an Order sequence does — nothing of theirs stays up
  // after they have said to end it.
  useEffect(() => {
    if (!active) return;
    void fetch('/api/spotify/session', { cache: 'no-store' })
      .then((response) => response.json() as Promise<{ connected: boolean }>)
      .then((session) => {
        setConnected(session.connected);
        if (!session.connected) reset();
      })
      .catch(() => setConnected(false));
  }, [active, reset]);

  const writeSlot = (index: number, seed: SeedSlot) => {
    setSeeds((current) => current.map((existing, i) => (i === index ? seed : existing)));
    setError(null);
  };

  const find = useCallback(() => {
    if (connected === false) {
      setError(NOT_CONNECTED);
      return;
    }
    // Every seed arrives from the picker already resolved, so all three fields
    // travel. The engine then fetches each one by id rather than searching its
    // title again — which is the difference between ranking against the sleeve
    // the listener actually saw and against whichever pressing search returns.
    const given: DiscoverSeed[] = filled.map((seed) => ({
      title: seed.title,
      artist: seed.artist,
      spotifyId: seed.spotifyId,
    }));
    void start(given);
  }, [connected, filled, setError, start]);

  const searching = phase === 'searching';

  return (
    <div className={styles.stack}>
      <ScanBar active={searching} label="Reading covers" />

      <SeedSlots
        seeds={seeds}
        onSelect={(index, seed) => writeSlot(index, seed)}
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

      {/*
        * The mark used to appear with the results, because that was the only
        * place Spotify's content reached the screen. The seed picker now shows
        * its covers and its metadata from the second character typed, so the
        * mark belongs to the whole panel and stands whatever state it is in.
        */}
      <SpotifyAttribution label="Search, track data and cover colours" />

      {phase === 'empty' ? <DiscoverEmpty /> : null}
      {phase === 'results' ? <DiscoverResults items={results} /> : null}
    </div>
  );
}
