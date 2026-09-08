import Link from 'next/link';

import styles from './LegalPage.module.css';

interface LegalPageProps {
  title: string;
  updated: string;
  children: React.ReactNode;
}

/** Shared frame for the privacy policy and the end user agreement. */
export function LegalPage({ title, updated, children }: LegalPageProps) {
  return (
    <main id="main" className={styles.page}>
      <Link className={`${styles.back} microLabel`} href="/">
        ← Back to Spettro
      </Link>
      <h1 className={styles.title}>{title}</h1>
      <p className={`${styles.updated} microLabel`}>Last updated {updated}</p>
      <div className={styles.body}>{children}</div>
    </main>
  );
}

export { styles as legalStyles };
