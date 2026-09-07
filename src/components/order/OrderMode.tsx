'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { ScanBar } from '@/components/ScanBar';
import { PlaylistForm } from '@/components/ui/PlaylistForm';
import { useOrderSequence } from '@/hooks/useOrderSequence';
import { isSpotifyPlaylistUrl } from '@/lib/playlist';
import { sequenceStats } from '@/lib/stats';

import { EmptyState } from './EmptyState';
import styles from './OrderMode.module.css';
import { SpectrumGrid } from './SpectrumGrid';
import { SpotifyAttribution } from './SpotifyAttribution';
import { SpotifyConnect } from './SpotifyConnect';
import { StatsPanel } from './StatsPanel';

const INVALID_LINK =
  'That link is not a Spotify playlist. Paste a link that begins with open.spotify.com/playlist.';
const NOT_CONNECTED = 'Connect your Spotify account first — Spettro reads playlists as you.';

export function OrderMode() {
  const [url, setUrl] = useState('');
  const [connected, setConnected] = useState<boolean | null>(null);
  const { phase, revealed, tracks, error, setError, start, reset } = useOrderSequence();
  const stats = useMemo(() => sequenceStats(tracks), [tracks]);

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
        placeholder="Paste a Spotify playlist link"
        submitLabel="Sequence"
        error={error}
      />

      {phase === 'empty' ? <EmptyState /> : null}
      {phase === 'result' ? <StatsPanel stats={stats} /> : null}
      {/* Wherever Spotify's covers and metadata show, so does its mark. */}
      {phase === 'empty' ? null : <SpotifyAttribution />}
      {phase === 'processing' || phase === 'result' ? (
        <SpectrumGrid tracks={tracks} revealed={phase === 'processing' ? revealed : null} />
      ) : null}
    </div>
  );
}
