'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { ScanBar } from '@/components/ScanBar';
import { SpotifyAttribution } from '@/components/SpotifyAttribution';
import { PlaylistForm } from '@/components/ui/PlaylistForm';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useOrderSequence } from '@/hooks/useOrderSequence';
import { isSpotifyPlaylistUrl } from '@/lib/playlist';
import { sequenceStats } from '@/lib/stats';

import { EmptyState } from './EmptyState';
import styles from './OrderMode.module.css';
import { SpectrumGrid } from './SpectrumGrid';
import { SpotifyConnect } from './SpotifyConnect';
import { StatsPanel } from './StatsPanel';

const INVALID_LINK =
  'That link is not a Spotify playlist. Paste a link that begins with open.spotify.com/playlist.';
const NOT_CONNECTED = 'Connect your Spotify account first — Spettro reads playlists as you.';

export function OrderMode() {
  const [url, setUrl] = useState('');
  const [connected, setConnected] = useState<boolean | null>(null);
  const { phase, revealed, tracks, meta, error, setError, start, reset } = useOrderSequence();
  const stats = useMemo(() => sequenceStats(tracks, meta?.dropped ?? 0), [tracks, meta]);

  /*
   * The read-out comes before the grid on a wide screen and after it on a
   * phone, where the grid is the thing worth seeing first and three cards
   * ahead of it push it off the fold.
   *
   * This moves the markup rather than setting `order` on the stack, and that is
   * the whole point of doing it here. `order` moves what is painted and leaves
   * the document alone, so Tab and a screen reader would still have gone
   * through the figures before reaching the covers, against what is on screen.
   * The grid has the same rule written into it already — the serpentine turn is
   * drawn with `direction`, and its DOM stays in sequence order for exactly
   * this reason. Rendering in one place or the other keeps the two orders the
   * same one, and there is nothing to keep in step afterwards.
   *
   * `useMediaQuery` reads `false` before the client has measured. Nothing
   * depends on that: the read-out exists only once a sequence has been run,
   * which is long after.
   */
  const wide = useMediaQuery('(min-width: 761px)');
  const readout = phase === 'result' ? <StatsPanel stats={stats} /> : null;

  const refreshSession = useCallback(
    () =>
      fetch('/api/spotify/session', { cache: 'no-store' })
        .then((response) => response.json() as Promise<{ connected: boolean }>)
        .then((session) => setConnected(session.connected))
        .catch(() => setConnected(false)),
    [],
  );

  useEffect(() => {
    // The OAuth callback lands back here with its outcome in the query string;
    // it is read once and wiped so a reload does not replay it.
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('auth_error');
    if (authError) setError(authError);
    if (authError || params.has('connected')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    void refreshSession();
  }, [refreshSession, setError]);

  const disconnect = useCallback(async () => {
    // Nothing of theirs stays on screen either: the sequence goes with the session.
    reset();
    setConnected(false);
    await fetch('/api/spotify/session', { method: 'DELETE' }).catch(() => {});
  }, [reset]);

  const handleSubmit = () => {
    if (!isSpotifyPlaylistUrl(url)) {
      setError(INVALID_LINK);
      return;
    }
    if (connected === false) {
      setError(NOT_CONNECTED);
      return;
    }
    // Anything that goes wrong from here on reports through the same slot, and
    // the connection state is re-read in case the run failed because it lapsed.
    void start(url).finally(refreshSession);
  };

  return (
    <div className={styles.stack}>
      <ScanBar active={phase === 'processing'} label="Reading covers" />

      <SpotifyConnect connected={connected} onDisconnect={() => void disconnect()} />

      <PlaylistForm
        value={url}
        onChange={(next) => {
          setUrl(next);
          setError(null);
        }}
        onSubmit={handleSubmit}
        label="Spotify playlist link"
        placeholder="Paste a Spotify playlist link…"
        submitLabel="Sequence"
        error={error}
      />

      {phase === 'empty' ? <EmptyState /> : null}
      {wide ? readout : null}
      {/*
        * Wherever Spotify's covers and metadata show, so does its mark — and
        * above the grid at both widths, which is where the guidelines put it.
        * Only the read-out changes sides.
        */}
      {phase === 'empty' ? null : <SpotifyAttribution />}
      {phase === 'processing' || phase === 'result' ? (
        <SpectrumGrid tracks={tracks} revealed={phase === 'processing' ? revealed : null} />
      ) : null}
      {wide ? null : readout}
    </div>
  );
}
