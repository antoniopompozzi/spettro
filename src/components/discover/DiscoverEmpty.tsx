import styles from './DiscoverEmpty.module.css';

/**
 * A finished search that found nothing.
 *
 * This is a real answer and not a failure, and it has several honest causes:
 * Last.fm may know none of the seeds, the search may have found no confident
 * match on Spotify for the names it did return, or the tempo filter may have
 * taken everything that was left. Which one it was is in the response's `meta`,
 * and none of them is worth explaining to a listener — what they can act on is
 * the same in every case, so the panel says that instead of leaving a blank
 * list or borrowing the wording of an error.
 */
export function DiscoverEmpty() {
  return (
    <section className={styles.panel} role="status">
      <h2 className={`${styles.heading} microLabel`}>No tracks for these seeds</h2>
      <p className={styles.body}>
        Nothing came back close enough in colour and tempo to these songs. Try a different
        seed, or a better-known one — obscure records have fewer neighbours to draw on.
      </p>
    </section>
  );
}
