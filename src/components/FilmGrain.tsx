import styles from './FilmGrain.module.css';

/** Fixed, non-interactive film-grain overlay sitting above the whole app. */
export function FilmGrain() {
  return (
    <>
      <div className={`${styles.layer} ${styles.fine}`} aria-hidden="true" />
      <div className={`${styles.layer} ${styles.coarse}`} aria-hidden="true" />
    </>
  );
}
