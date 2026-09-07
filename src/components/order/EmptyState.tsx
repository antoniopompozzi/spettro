import styles from './EmptyState.module.css';

export function EmptyState() {
  return (
    <section className={styles.panel}>
      <h2 className={`${styles.heading} microLabel`}>No sequence yet</h2>
      <p className={styles.body}>
        Paste a playlist link above and Spettro will read the artwork of every track, then
        reorder the whole playlist so the covers move through the colour spectrum from dark
        to light.
      </p>
    </section>
  );
}
