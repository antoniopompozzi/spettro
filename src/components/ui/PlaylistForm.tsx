'use client';

import { useId } from 'react';

import { FormError } from './FormError';
import styles from './PlaylistForm.module.css';

interface PlaylistFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  label: string;
  placeholder: string;
  submitLabel: string;
  error?: string | null;
}

/** The paste-a-playlist-link row, shared by both modes. */
export function PlaylistForm({
  value,
  onChange,
  onSubmit,
  label,
  placeholder,
  submitLabel,
  error,
}: PlaylistFormProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;

  return (
    <div>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label className="srOnly" htmlFor={inputId}>
          {label}
        </label>
        <input
          id={inputId}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          className={`${styles.input} ${error ? styles.invalid : ''}`}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        <button type="submit" className={styles.submit}>
          {submitLabel}
        </button>
      </form>
      <FormError id={errorId}>{error}</FormError>
    </div>
  );
}
