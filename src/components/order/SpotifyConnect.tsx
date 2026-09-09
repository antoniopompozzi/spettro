'use client';

import Link from 'next/link';

import styles from './SpotifyConnect.module.css';

interface SpotifyConnectProps {
  /** `null` while the session is still being read. */
  connected: boolean | null;
  onDisconnect: () => void;
}

const SPOTIFY_APPS = 'https://www.spotify.com/account/apps/';

/**
 * Order needs a signed-in listener: Spotify only serves playlist items to the
 * owner of the playlist, so there is no way to read one from an app token.
 *
 * Everything a person needs before deciding sits here rather than in a footer —
 * what Spettro will read, the two agreements, and, once connected, a plain
 * disconnect that says what it does. Spotify's terms require both the notice
 * before sign-in and a disconnect that is easy to find and explained.
 */
export function SpotifyConnect({ connected, onDisconnect }: SpotifyConnectProps) {
  if (connected === null) return <section className={styles.block} aria-hidden="true" />;

  return (
    <section className={styles.block} aria-label="Spotify account">
      <div className={styles.row}>
        <p className={`${styles.status} microLabel`}>
          <span className={`${styles.dot} ${connected ? '' : styles.off}`} aria-hidden="true" />
          {/*
            * On a phone the row ran out of width and this text sat against the
            * button. It is hidden there rather than dropped: the dot alone is
            * the whole indicator on screen, and it is `aria-hidden`, so without
            * these words the section would announce nothing but its own label.
            */}
          <span className={styles.statusText}>
            {connected ? 'Spotify connected' : 'Spotify not connected'}
          </span>
        </p>
        {connected ? (
          <button type="button" className={`${styles.action} microLabel`} onClick={onDisconnect}>
            Disconnect from Spotify
          </button>
        ) : (
          <a className={`${styles.action} microLabel`} href="/api/spotify/login">
            Connect with Spotify
          </a>
        )}
      </div>

      <div className={styles.detail}>
        <p className={styles.note}>
          {connected ? (
            <>
              Disconnecting deletes your session here immediately and Spettro stops being able
              to reach your account. It stores nothing else, so nothing is left behind. You can
              also withdraw access from{' '}
              <a href={SPOTIFY_APPS} target="_blank" rel="noreferrer">
                your Spotify account settings
              </a>
              .
            </>
          ) : (
            <>
              Spettro reads the tracks of the playlist you paste — their titles, artists and
              cover art — to work out the colour order. It never reads your profile and keeps
              nothing on a server.
            </>
          )}
        </p>

        <p className={`${styles.links} microLabel`}>
          <Link href="/privacy">Privacy policy</Link>
          <span className={styles.separator} aria-hidden="true">
            ·
          </span>
          <Link href="/terms">Terms</Link>
        </p>
      </div>
    </section>
  );
}
