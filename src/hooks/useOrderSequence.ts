'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { OrderPhase, Track } from '@/lib/types';

const REVEAL_DURATION_MS = 2400;
const REVEAL_TICKS = 24;
const SETTLE_MS = 320;

function shuffled<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Drives the three Order phases. The reveal walks a shuffled list of ids so the
 * covers surface out of order, the way a batch of parallel lookups would land.
 *
 * The timings are a stand-in for real work; when the Spotify and colour steps
 * arrive, `start` becomes the place that awaits them.
 */
export function useOrderSequence(tracks: readonly Track[]) {
  const [phase, setPhase] = useState<OrderPhase>('empty');
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  const interval = useRef<number | null>(null);
  const settle = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (interval.current !== null) window.clearInterval(interval.current);
    if (settle.current !== null) window.clearTimeout(settle.current);
    interval.current = null;
    settle.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    const order = shuffled(tracks.map((track) => track.id));
    setPhase('processing');
    setRevealed(new Set());

    let tick = 0;
    interval.current = window.setInterval(() => {
      tick += 1;
      const upTo = Math.ceil((order.length * tick) / REVEAL_TICKS);
      setRevealed(new Set(order.slice(0, upTo)));
      if (tick >= REVEAL_TICKS) {
        clearTimers();
        settle.current = window.setTimeout(() => setPhase('result'), SETTLE_MS);
      }
    }, REVEAL_DURATION_MS / REVEAL_TICKS);
  }, [clearTimers, tracks]);

  return { phase, revealed, start };
}
