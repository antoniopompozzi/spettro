'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { DiscoverResponse, DiscoverSeed, Suggestion } from '@/lib/types';

const GENERIC_FAILURE = 'Spettro could not look for similar tracks. Try again.';

/**
 * Idle until the first search; `empty` is a finished search that found nothing,
 * which is a real answer and not a failure, and has to be told apart from
 * `idle` so the page can say which of the two happened.
 */
export type DiscoverPhase = 'idle' | 'searching' | 'results' | 'empty';

/**
 * Drives Discover around a real call to `/api/discover`.
 *
 * Simpler than `useOrderSequence` on purpose: Order animates a grid revealing
 * itself because the covers arrive over several seconds and the wait is the
 * thing being shown. A list of twenty rows has nothing to stage, so this holds
 * three states and a progress line.
 */
export function useDiscover() {
  const [phase, setPhase] = useState<DiscoverPhase>('idle');
  const [results, setResults] = useState<readonly Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  /**
   * The run's funnel. Nothing on screen reads it today, but it is what the API
   * answers with, and dropping it here would mean asking the server again to
   * find out why a search came back short.
   */
  const [meta, setMeta] = useState<DiscoverResponse['meta'] | null>(null);

  const abort = useRef<AbortController | null>(null);
  /** Bumped on every start, so a superseded run cannot touch state. */
  const runId = useRef(0);

  const stop = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(
    async (seeds: readonly DiscoverSeed[]) => {
      stop();
      const run = (runId.current += 1);
      const controller = new AbortController();
      abort.current = controller;

      setError(null);
      setPhase('searching');
      setResults([]);
      setMeta(null);

      try {
        const response = await fetch('/api/discover', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ seeds }),
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => null)) as
          | (Partial<DiscoverResponse> & { error?: string })
          | null;

        if (!response.ok) throw new Error(body?.error ?? GENERIC_FAILURE);
        if (runId.current !== run) return;

        const found = body?.results ?? [];
        setResults(found);
        setMeta(body?.meta ?? null);
        // An empty list is an outcome, not an error: Last.fm may know none of
        // the seeds, or the tempo filter may have taken everything. The page
        // says so instead of showing a blank panel.
        setPhase(found.length > 0 ? 'results' : 'empty');
      } catch (cause) {
        if (runId.current !== run || controller.signal.aborted) return;
        stop();
        setPhase('idle');
        setResults([]);
        setMeta(null);
        setError(cause instanceof Error ? cause.message : GENERIC_FAILURE);
      }
    },
    [stop],
  );

  /** Drops whatever is on screen: used when the account is disconnected. */
  const reset = useCallback(() => {
    stop();
    runId.current += 1;
    setPhase('idle');
    setResults([]);
    setMeta(null);
    setError(null);
  }, [stop]);

  return { phase, results, meta, error, setError, start, reset };
}
