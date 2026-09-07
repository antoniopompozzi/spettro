import styles from './EmptyState.module.css';

export function EmptyState() {
  return (
    <section className={styles.panel}>
      <h2 className={`${styles.heading} microLabel`}>No sequence yet</h2>
      <p className={styles.body}>
        Connect your Spotify account and pick one of your playlists. Spettro reads the
        artwork of every track, then reorders the whole playlist so the covers move
        through the colour spectrum from dark to light.
      </p>
    </section>
  );
}
