import 'server-only';

import { OrderError } from './errors';

/**
 * A per-IP ceiling on every API route, held in this process's memory.
 *
 * In memory is the right size for this app: one Node process, no database, and
 * a limit that only has to blunt a script. It resets when the server restarts
 * and it is not shared between instances — both acceptable here, and both
 * reasons this must not be mistaken for an abuse defence that survives scaling.
 *
 * The ceilings differ by what a call costs *upstream*, not by what it costs
 * here. Sequencing a playlist is one request to Spettro and dozens to Spotify
 * and ReccoBeats, so exceeding their quotas takes the app down for everybody,
 * not just for whoever was hammering it.
 */
export interface Limit {
  /** Requests allowed inside one window. */
  readonly max: number;
  /** Window length in milliseconds. */
  readonly windowMs: number;
}

/** Sign-in and callback: nothing legitimate needs these in bulk. */
export const AUTH_LIMIT: Limit = { max: 10, windowMs: 10 * 60_000 };
/** Sequencing: generous for a person, far below what a loop would ask for. */
export const ORDER_LIMIT: Limit = { max: 12, windowMs: 5 * 60_000 };
/** Session reads: cheap and polled by the page, so the ceiling is high. */
export const READ_LIMIT: Limit = { max: 60, windowMs: 60_000 };

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Survives the module reloads the dev server does on every edit — otherwise the
 * counters would reset constantly while developing and the limit would never be
 * observable.
 */
const store: Map<string, Window> = ((globalThis as Record<string, unknown>)
  .__spettroRateLimit as Map<string, Window>) ?? new Map<string, Window>();
(globalThis as Record<string, unknown>).__spettroRateLimit = store;

/** Dropped windows are only cleared when someone calls, which is often enough. */
const SWEEP_EVERY = 256;
let sinceSweep = 0;

function sweep(now: number): void {
  sinceSweep += 1;
  if (sinceSweep < SWEEP_EVERY) return;
  sinceSweep = 0;
  for (const [key, window] of store) {
    if (window.resetAt <= now) store.delete(key);
  }
}

/**
 * Who is calling, as far as a hosted Node process can tell.
 *
 * Behind a proxy the socket address is the proxy's, so the forwarded headers
 * are what identify the caller — and they are also client-controlled, which is
 * why this is a rate limit and not an access control. `x-forwarded-for` is a
 * list; the first entry is the original client.
 */
function callerKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Counts this call against `bucket` and throws a 429 once the window is full.
 *
 * Throws `OrderError`, so every route already answers it the same way it
 * answers its other refusals — with a sentence a person can read.
 */
export function enforceRateLimit(request: Request, bucket: string, limit: Limit): void {
  const now = Date.now();
  sweep(now);

  const key = `${bucket}:${callerKey(request)}`;
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + limit.windowMs });
    return;
  }

  current.count += 1;
  if (current.count <= limit.max) return;

  const seconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  throw new RateLimited(seconds);
}

/** A 429 that carries how long the caller should wait. */
export class RateLimited extends OrderError {
  constructor(readonly retryAfterSeconds: number) {
    super(
      429,
      `Too many requests. Wait ${retryAfterSeconds > 60 ? `${Math.ceil(retryAfterSeconds / 60)} minutes` : `${retryAfterSeconds} seconds`} and try again.`,
    );
    this.name = 'RateLimited';
  }
}

/** The JSON refusal, with the header a well-behaved client honours. */
export function rateLimitedResponse(error: RateLimited): Response {
  return Response.json(
    { error: error.message },
    { status: 429, headers: { 'retry-after': String(error.retryAfterSeconds) } },
  );
}
