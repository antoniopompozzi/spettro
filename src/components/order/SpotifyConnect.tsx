'use client';

import styles from './SpotifyConnect.module.css';

interface SpotifyConnectProps {
  /** `null` while the session is still being read. */
  connected: boolean | null;
  onDisconnect: () => void;
}

/**
 * Order needs a signed-in listener: Spotify only serves playlist items to the
 * owner of the playlist, so there is no way to read one from an app token.
 */
export function SpotifyConnect({ connected, onDisconnect }: SpotifyConnectProps) {
  if (connected === null) return <div className={styles.row} aria-hidden="true" />;

  return (
    <div className={styles.row}>
      <p className={`${styles.status} microLabel`}>
        <span className={`${styles.dot} ${connected ? '' : styles.off}`} aria-hidden="true" />
        {connected ? 'Spotify connected' : 'Spotify not connected'}
      </p>
      {connected ? (
        <button type="button" className={`${styles.action} ${styles.quiet} microLabel`} onClick={onDisconnect}>
          Disconnect
        </button>
      ) : (
        <a className={`${styles.action} microLabel`} href="/api/spotify/login">
          Connect Spotify
        </a>
      )}
    </div>
  );
}
