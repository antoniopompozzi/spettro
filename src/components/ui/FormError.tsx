import styles from './FormError.module.css';

/** Live region for a single form-level message; renders nothing when empty. */
export function FormError({ id, children }: { id: string; children?: string | null }) {
  return (
    <div role="status" aria-live="polite">
      {children ? (
        <p id={id} className={`${styles.error} mono`}>
          {children}
        </p>
      ) : null}
    </div>
  );
}
