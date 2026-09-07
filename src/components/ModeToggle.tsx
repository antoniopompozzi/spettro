'use client';

import { useRef } from 'react';

import styles from './ModeToggle.module.css';

export type Mode = 'order' | 'discover';

const MODES: ReadonlyArray<{ id: Mode; label: string }> = [
  { id: 'order', label: 'Order' },
  { id: 'discover', label: 'Discover' },
];

interface ModeToggleProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  // Roving focus, as a tablist is expected to behave.
  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    let next = -1;
    if (step !== 0) next = (index + step + MODES.length) % MODES.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = MODES.length - 1;
    if (next === -1) return;

    event.preventDefault();
    onChange(MODES[next].id);
    tabs.current[next]?.focus();
  };

  return (
    <div className={styles.toggle} role="tablist" aria-label="Mode">
      {MODES.map(({ id, label }, index) => (
        <button
          key={id}
          ref={(node) => {
            tabs.current[index] = node;
          }}
          type="button"
          role="tab"
          id={`tab-${id}`}
          aria-selected={mode === id}
          aria-controls={`panel-${id}`}
          tabIndex={mode === id ? 0 : -1}
          className={`${styles.option} ${mode === id ? styles.active : ''}`}
          onClick={() => onChange(id)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
