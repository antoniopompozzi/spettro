import type { Stat } from '@/lib/types';

import styles from './StatsPanel.module.css';

export function StatsPanel({ stats }: { stats: readonly Stat[] }) {
  return (
    <section className={styles.panel} aria-label="Sequence readout">
      {stats.map((stat) => (
        <div key={stat.label} className={styles.card}>
          <div className={`${styles.label} microLabel`}>{stat.label}</div>
          <div className={`${styles.value} mono`}>{stat.value}</div>
        </div>
      ))}
    </section>
  );
}
