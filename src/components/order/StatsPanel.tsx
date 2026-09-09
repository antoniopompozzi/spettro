import { hueSwatchHex } from '@/lib/color';
import type { Stat } from '@/lib/types';

import styles from './StatsPanel.module.css';

export function StatsPanel({ stats }: { stats: readonly Stat[] }) {
  return (
    <section className={styles.panel} aria-label="Sequence readout">
      {stats.map((stat) => (
        <div key={stat.label} className={styles.card}>
          <div className={`${styles.label} microLabel`}>{stat.label}</div>
          <div className={styles.figure}>
            <span className={`${styles.value} mono`}>{stat.value}</span>
            {/*
              * Decorative: it is the hue printed beside it, drawn. Anybody
              * reading the card aloud gets the angle, which is the fact.
              */}
            {stat.swatchHue === undefined ? null : (
              <span
                className={styles.swatch}
                style={{ background: hueSwatchHex(stat.swatchHue) }}
                aria-hidden="true"
              />
            )}
          </div>
          {stat.detail === undefined ? null : (
            <div className={`${styles.detail} mono`}>
              <span aria-hidden="true">{stat.detail}</span>
              <span className="srOnly">{stat.detailLabel ?? stat.detail}</span>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
