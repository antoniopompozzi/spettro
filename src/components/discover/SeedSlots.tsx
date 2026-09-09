'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import type { SeedSlot, SeedSuggestion } from '@/lib/types';

import styles from './SeedSlots.module.css';

const LABELS = ['Song 1', 'Song 2 (optional)', 'Song 3 (optional)'] as const;

/**
 * How long typing has to stop before Spotify is asked.
 *
 * Generous on purpose. A search-as-you-type box is the easiest way there is to
 * spend an app's Spotify quota, and this one has already been measured
 * exhausting it — three slots, ten characters each, is thirty requests at one
 * per keystroke. At 300ms an ordinary typist sends one request per word rather
 * than per letter, and the list still lands before they have finished looking
 * at the field.
 */
const DEBOUNCE_MS = 300;

/** One letter matches most of the catalogue, so the answer would be noise. */
const MIN_QUERY = 2;

/**
 * What a slot is doing, which is five different things that would otherwise all
 * render as an empty list.
 *
 * `empty` and `failed` are the pair worth keeping apart. Spotify answering that
 * it has nothing is a fact about the catalogue and means try different words;
 * Spotify not answering is a fact about the afternoon and means try the same
 * words again. The engine already tells these apart for its own lookups, and a
 * search box that called an outage "no songs match that" would be sending the
 * person to fix a spelling that was never wrong.
 */
type Status = 'idle' | 'searching' | 'results' | 'empty' | 'failed';

interface SlotState {
  /** What is in the field, which is not the same as what has been picked. */
  query: string;
  results: readonly SeedSuggestion[];
  status: Status;
  open: boolean;
  /** Index of the keyboard-highlighted option, or -1 for none. */
  active: number;
}

const BLANK: SlotState = { query: '', results: [], status: 'idle', open: false, active: -1 };

interface SeedSlotsProps {
  seeds: readonly SeedSlot[];
  /** A record was chosen: title, artist and Spotify id together. */
  onSelect: (index: number, seed: NonNullable<SeedSlot>) => void;
  onClear: (index: number) => void;
}

/**
 * The three seed fields, each a combobox over Spotify's catalogue.
 *
 * A seed is chosen here and never typed. The field's text is only ever a query
 * or the title of what was picked — it is restored to the picked title on the
 * way out if somebody starts editing and changes their mind, so the field can
 * never show one record while the app holds another.
 *
 * Covers are in the list because a title and an artist do not tell two records
 * apart the way a sleeve does, and the sleeve is what Spettro is going to
 * measure. Picking the wrong pressing here would rank the whole search on the
 * wrong colour.
 */
export function SeedSlots({ seeds, onSelect, onClear }: SeedSlotsProps) {
  const groupId = useId();
  const [slots, setSlots] = useState<SlotState[]>(() => seeds.map(() => ({ ...BLANK })));

  const timers = useRef<Array<number | null>>(seeds.map(() => null));
  const aborts = useRef<Array<AbortController | null>>(seeds.map(() => null));
  /** Bumped per slot on every keystroke, so a slow answer cannot overwrite a fast one. */
  const runs = useRef<number[]>(seeds.map(() => 0));

  const patch = useCallback((index: number, change: Partial<SlotState>) => {
    setSlots((current) => current.map((slot, i) => (i === index ? { ...slot, ...change } : slot)));
  }, []);

  const cancel = useCallback((index: number) => {
    const timer = timers.current[index];
    if (timer !== null) window.clearTimeout(timer);
    timers.current[index] = null;
    aborts.current[index]?.abort();
    aborts.current[index] = null;
  }, []);

  useEffect(() => {
    const stop = cancel;
    return () => slots.forEach((_, i) => stop(i));
    // Unmount only: the cleanup reads the refs, which are current by then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = useCallback(
    (index: number, query: string) => {
      cancel(index);
      const trimmed = query.trim();
      if (trimmed.length < MIN_QUERY) {
        patch(index, { results: [], status: 'idle', open: false, active: -1 });
        return;
      }

      patch(index, { status: 'searching', open: true, active: -1 });
      timers.current[index] = window.setTimeout(() => {
        const run = (runs.current[index] += 1);
        const controller = new AbortController();
        aborts.current[index] = controller;

        void fetch(`/api/spotify/search?q=${encodeURIComponent(trimmed)}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
          .then(async (response) => {
            // A refusal carries a readable sentence and no `results` key at
            // all, so reading the body without checking the status is how a
            // 429 comes out as an empty catalogue.
            if (!response.ok) return null;
            return (await response.json()) as { results?: SeedSuggestion[] };
          })
          .then((body) => {
            if (runs.current[index] !== run) return;
            if (!body) {
              patch(index, { results: [], status: 'failed', open: true, active: -1 });
              return;
            }
            const results = body.results ?? [];
            patch(index, {
              results,
              status: results.length > 0 ? 'results' : 'empty',
              open: true,
              active: -1,
            });
          })
          .catch(() => {
            if (runs.current[index] !== run || controller.signal.aborted) return;
            patch(index, { results: [], status: 'failed', open: true, active: -1 });
          });
      }, DEBOUNCE_MS);
    },
    [cancel, patch],
  );

  const choose = useCallback(
    (index: number, suggestion: SeedSuggestion) => {
      cancel(index);
      onSelect(index, {
        title: suggestion.title,
        artist: suggestion.artist,
        spotifyId: suggestion.spotifyId,
      });
      patch(index, {
        query: suggestion.title,
        results: [],
        status: 'idle',
        open: false,
        active: -1,
      });
    },
    [cancel, onSelect, patch],
  );

  const clear = useCallback(
    (index: number) => {
      cancel(index);
      onClear(index);
      patch(index, { ...BLANK });
    },
    [cancel, onClear, patch],
  );

  /**
   * Leaving a slot mid-edit puts the picked title back.
   *
   * Otherwise the field would sit there showing half a different song while the
   * app still holds the one that was picked, and the Find button would be
   * enabled on a seed nothing on screen names.
   */
  const settle = useCallback(
    (index: number) => {
      cancel(index);
      const seed = seeds[index];
      patch(index, {
        query: seed ? seed.title : '',
        results: [],
        status: 'idle',
        open: false,
        active: -1,
      });
    },
    [cancel, patch, seeds],
  );

  return (
    <section className={styles.slots} aria-label="Seeds">
      {seeds.map((seed, index) => {
        const slot = slots[index] ?? BLANK;
        const fieldId = `${groupId}-seed-${index}`;
        const listId = `${groupId}-list-${index}`;
        const activeId = slot.active >= 0 ? `${listId}-option-${slot.active}` : undefined;
        // Editing a slot that already holds a pick. Worth its own word on
        // screen: the seed is still the old one until a new one is chosen.
        const replacing = Boolean(seed) && slot.query !== seed?.title;

        const move = (delta: number) => {
          if (slot.results.length === 0) return;
          const next =
            (slot.active + delta + slot.results.length + 1) % (slot.results.length + 1);
          patch(index, { active: next === slot.results.length ? -1 : next, open: true });
        };

        return (
          <div key={index} className={`${styles.slot} ${seed ? styles.filled : ''}`}>
            <label className={`${styles.label} mono`} htmlFor={fieldId}>
              {LABELS[index]}
            </label>

            <div className={styles.field}>
              <span className={`${styles.index} mono`} aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <input
                id={fieldId}
                className={styles.input}
                value={slot.query}
                placeholder={index === 0 ? 'Search for a song…' : 'Optional…'}
                autoComplete="off"
                role="combobox"
                aria-expanded={slot.open}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={activeId}
                onChange={(event) => {
                  patch(index, { query: event.target.value });
                  search(index, event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    move(1);
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    move(-1);
                  } else if (event.key === 'Enter') {
                    // Only ever picks from the list. Enter on a typed string
                    // must not invent a seed: the whole point is that a seed is
                    // a record somebody saw, not a guess at what they meant.
                    if (slot.open && slot.active >= 0 && slot.results[slot.active]) {
                      event.preventDefault();
                      choose(index, slot.results[slot.active]);
                    }
                  } else if (event.key === 'Escape') {
                    settle(index);
                  }
                }}
                onBlur={(event) => {
                  // Clicking an option blurs the input before the click lands,
                  // so a move inside this slot is not a departure.
                  if (event.currentTarget.closest(`.${styles.slot}`)?.contains(event.relatedTarget)) {
                    return;
                  }
                  settle(index);
                }}
              />
              {seed || slot.query ? (
                <button
                  type="button"
                  className={`${styles.clear} mono`}
                  onClick={() => clear(index)}
                  aria-label={`Clear ${LABELS[index]}`}
                >
                  ×
                </button>
              ) : null}
            </div>

            {/*
              * One line under the field, carrying whichever of the states is
              * true. A live region so the four are announced as they change —
              * the list itself is only reachable once there is something in it.
              */}
            <p className={styles.under} role="status">
              {replacing ? (
                <span className={styles.replacing}>
                  Replacing {seed?.title} — {seed?.artist}
                </span>
              ) : slot.status === 'searching' ? (
                <span className={styles.searching}>Searching Spotify…</span>
              ) : slot.status === 'empty' ? (
                <span className={styles.none}>No songs match that.</span>
              ) : slot.status === 'failed' ? (
                <span className={styles.failed}>Spotify did not answer. Try again.</span>
              ) : seed ? (
                <span className={styles.picked}>{seed.artist}</span>
              ) : null}
            </p>

            <ul className={`${styles.list} ${slot.open && slot.results.length > 0 ? '' : styles.hidden}`} id={listId} role="listbox" aria-label={`${LABELS[index]} results`}>
              {slot.results.map((result, position) => (
                <li
                  key={result.spotifyId}
                  id={`${listId}-option-${position}`}
                  className={`${styles.option} ${position === slot.active ? styles.active : ''}`}
                  role="option"
                  aria-selected={position === slot.active}
                  // The input keeps focus, so this is a mousedown rather than a
                  // click: a click would land after the blur that closes the list.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(index, result);
                  }}
                  onMouseEnter={() => patch(index, { active: position })}
                >
                  {result.thumb ? (
                    // Square art in a square frame, so `object-fit` never crops
                    // it. Named by the row it sits in rather than announced
                    // twice: the option's own text is the title and artist.
                    // eslint-disable-next-line @next/next/no-img-element -- fixed 40px thumbnail
                    <img className={styles.thumb} src={result.thumb} alt="" width={40} height={40} />
                  ) : (
                    <span className={styles.thumb} aria-hidden="true" />
                  )}
                  <span className={styles.optionText}>
                    <span className={styles.optionTitle}>{result.title}</span>
                    <span className={styles.optionArtist}>
                      {result.artist}
                      {result.explicit ? (
                        <span className={styles.explicit}>
                          <span aria-hidden="true">E</span>
                          <span className="srOnly">Explicit content</span>
                        </span>
                      ) : null}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
