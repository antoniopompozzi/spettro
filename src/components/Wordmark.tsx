import styles from './Wordmark.module.css';

/** SPETTRO in Zen Dots, filled with horizontal CRT scanlines. */
export function Wordmark() {
  return <h1 className={`${styles.wordmark} scanlines`}>Spettro</h1>;
}
