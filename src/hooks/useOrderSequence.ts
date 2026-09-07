'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { OrderPhase, OrderResponse, Track } from '@/lib/types';

/** Blank plates standing in while the request is out and the count is unknown. */
const PLACEHOLDER_COUNT = 42;
const REVEAL_MS = 900;
const REVEAL_TICKS = 18;
const SETTLE_MS = 320;

const GENERIC_FAILURE = 'Spettro could not read that playlist. Try again.';

function shuffled<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Unread covers. They are never revealed — nothing about them is real — they
 * only hold the plate grid open while the covers are actually being read.
 */
function placeholders(count: number): Track[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `pending-${i}`,
    title: '',
    artist: '',
    color: '#000000',
  }));
}

/**
 * Drives the three Order phases around a real call to `/api/order`.
 *
 * Processing lasts as long as the request does: the grid sits on blank plates
 * for exactly as long as the covers are actually being read, then the tracks
 * that came back reveal in a shuffled order, the way a batch of parallel
 * lookups lands. No colour reaches the screen before it has been read off an
 * actual cover.
 */
export function useOrderSequence() {
  const [phase, setPhase] = useState<OrderPhase>('empty');
  const [tracks, setTracks] = useState<readonly Track[]>([]);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const interval = useRef<number | null>(null);
  const settle = useRef<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  /** Bumped on every start, so a superseded run cannot touch state. */
  const runId = useRef(0);

  const stop = useCallback(() => {
    if (interval.current !== null) window.clearInterval(interval.current);
    if (settle.current !== null) window.clearTimeout(settle.current);
    interval.current = null;
    settle.current = null;
    abort.current?.abort();
    abort.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const reveal = useCallback(
    (sequenced: readonly Track[]) => {
      const order = shuffled(sequenced.map((track) => track.id));
      let tick = 0;
      interval.current = window.setInterval(() => {
        tick += 1;
        const upTo = Math.ceil((order.length * tick) / REVEAL_TICKS);
        setRevealed(new Set(order.slice(0, upTo)));
        if (tick >= REVEAL_TICKS) {
          stop();
          settle.current = window.setTimeout(() => setPhase('result'), SETTLE_MS);
        }
      }, REVEAL_MS / REVEAL_TICKS);
    },
    [stop],
  );

  const start = useCallback(
    async (url: string) => {
      stop();
      const run = (runId.current += 1);
      const controller = new AbortController();
      abort.current = controller;

      setError(null);
      setPhase('processing');
      setTracks(placeholders(PLACEHOLDER_COUNT));
      setRevealed(new Set());

      try {
        const response = await fetch('/api/order', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url }),
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => null)) as
          | (Partial<OrderResponse> & { error?: string })
          | null;

        if (!response.ok || !body?.tracks?.length) {
          throw new Error(body?.error ?? GENERIC_FAILURE);
        }
        if (runId.current !== run) return;

        setTracks(body.tracks);
        reveal(body.tracks);
      } catch (cause) {
        if (runId.current !== run || controller.signal.aborted) return;
        stop();
        setPhase('empty');
        setTracks([]);
        setRevealed(new Set());
        setError(cause instanceof Error ? cause.message : GENERIC_FAILURE);
      }
    },
    [reveal, stop],
  );

  /** Drops whatever is on screen: used when the account is disconnected. */
  const reset = useCallback(() => {
    stop();
    runId.current += 1;
    setPhase('empty');
    setTracks([]);
    setRevealed(new Set());
    setError(null);
  }, [stop]);

  return { phase, revealed, tracks, error, setError, start, reset };
}
