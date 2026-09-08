'use client';

import { useState } from 'react';

import { ModeToggle, type Mode } from '@/components/ModeToggle';
import { Wordmark } from '@/components/Wordmark';
import { DiscoverMode } from '@/components/discover/DiscoverMode';
import { OrderMode } from '@/components/order/OrderMode';

import styles from './page.module.css';

export default function Home() {
  const [mode, setMode] = useState<Mode>('order');

  // Both panels stay mounted so a sequence survives a trip to Discover.
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <Wordmark />
        <ModeToggle mode={mode} onChange={setMode} />
      </header>

      <main id="main" className={styles.main}>
        <div id="panel-order" role="tabpanel" aria-labelledby="tab-order" hidden={mode !== 'order'}>
          <OrderMode />
        </div>
        <div
          id="panel-discover"
          role="tabpanel"
          aria-labelledby="tab-discover"
          hidden={mode !== 'discover'}
        >
          <DiscoverMode />
        </div>
      </main>
    </div>
  );
}
