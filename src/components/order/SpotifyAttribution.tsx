import styles from './SpotifyAttribution.module.css';

/**
 * Spotify's terms require the mark to accompany any of its metadata or artwork,
 * so this sits with the results rather than in a page footer. The mark stands
 * on its own, never inside a sentence and never over a cover, and the label
 * beside it stays outside its exclusion zone.
 */
export function SpotifyAttribution() {
  return (
    <section className={styles.row} aria-label="Data source">
      <p className={`${styles.label} microLabel`}>Covers and track data</p>
      <a
        className={styles.link}
        href="https://open.spotify.com"
        target="_blank"
        rel="noreferrer"
        aria-label="Open Spotify"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- official asset, fixed size */}
        <img
          className={styles.logo}
          src="/spotify/Full_Logo_White_RGB.svg"
          alt="Spotify"
          width={96}
          height={27}
        />
      </a>
    </section>
  );
}
