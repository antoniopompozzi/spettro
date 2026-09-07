import styles from './ScanBar.module.css';

/** Indeterminate progress line. Keeps its 2px of height when idle so the layout does not shift. */
export function ScanBar({ active, label }: { active: boolean; label: string }) {
  return (
    <div
      className={`${styles.track} ${active ? styles.active : ''}`}
      role="progressbar"
      aria-label={label}
      aria-busy={active}
      aria-hidden={!active}
    >
      <div className={styles.beam} />
    </div>
  );
}
