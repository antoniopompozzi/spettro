'use client';

import { useMemo, useState } from 'react';

import { ScanBar } from '@/components/ScanBar';
import { PlaylistForm } from '@/components/ui/PlaylistForm';
import { useOrderSequence } from '@/hooks/useOrderSequence';
import { mockSequence } from '@/lib/mock/tracks';
import { isSpotifyPlaylistUrl } from '@/lib/playlist';
import { sequenceStats } from '@/lib/stats';

import { EmptyState } from './EmptyState';
import styles from './OrderMode.module.css';
import { SpectrumGrid } from './SpectrumGrid';
import { StatsPanel } from './StatsPanel';

const INVALID_LINK =
  'That link is not a Spotify playlist. Paste a link that begins with open.spotify.com/playlist.';

export function OrderMode() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Mocked for now: the real sequence comes back from the API in a later step.
  const tracks = useMemo(() => mockSequence(), []);
  const stats = useMemo(() => sequenceStats(tracks), [tracks]);
  const { phase, revealed, start } = useOrderSequence(tracks);

  const handleSubmit = () => {
    if (!isSpotifyPlaylistUrl(url)) {
      setError(INVALID_LINK);
      return;
    }
    setError(null);
    start();
  };

  return (
    <div className={styles.stack}>
      <ScanBar active={phase === 'processing'} label="Reading covers" />

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
      {phase === 'processing' || phase === 'result' ? (
        <SpectrumGrid tracks={tracks} revealed={phase === 'processing' ? revealed : null} />
      ) : null}
    </div>
  );
}
