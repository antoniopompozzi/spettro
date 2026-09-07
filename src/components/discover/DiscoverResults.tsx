import { BPM_RANGE } from '@/lib/mock/tracks';
import type { Recommendation } from '@/lib/types';

import styles from './DiscoverResults.module.css';

/** Position of a tempo inside the display range, as a 0–100 percentage. */
function bpmShare(bpm: number): number {
  const span = BPM_RANGE.max - BPM_RANGE.min;
  const share = ((bpm - BPM_RANGE.min) / span) * 100;
  return Math.max(0, Math.min(100, Math.round(share)));
}

export function DiscoverResults({ items }: { items: readonly Recommendation[] }) {
  return (
    <section className={styles.list} aria-label="Results">
      {items.map((item) => (
        <article key={item.id} className={styles.row}>
          <div className={styles.cover} style={{ background: item.color }} aria-hidden="true" />
          <div className={styles.meta}>
            <div className={styles.title}>{item.title}</div>
            <div className={styles.artist}>{item.artist}</div>
          </div>
          <div className={styles.tempo}>
            <div className={`${styles.bpm} mono`}>
              {item.bpm}
              <span className="srOnly"> BPM</span>
            </div>
            <div className={styles.track} aria-hidden="true">
              <div className={styles.bar} style={{ width: `${bpmShare(item.bpm)}%` }} />
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
