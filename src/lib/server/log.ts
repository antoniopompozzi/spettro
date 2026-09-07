import 'server-only';

/**
 * A track title, an artist or a playlist id is a statement about somebody's
 * taste, and a hosting platform keeps whatever a server prints — often for
 * longer than the request and in a place nobody thinks about. Those details
 * earn their keep while building and have no business in a production log.
 *
 * So they go through `debug`, which is silent in production. Counts, failure
 * reasons and statuses carry nothing about a person and are logged normally.
 */
const DEVELOPMENT = process.env.NODE_ENV !== 'production';

/** Logs only in development. Use for anything that names a listener's music. */
export function debug(message: string, ...detail: unknown[]): void {
  if (DEVELOPMENT) console.info(message, ...detail);
}

/**
 * A failure summary safe to keep. In production only the error's type survives:
 * a thrown fetch error quotes the URL it failed on, and those URLs carry
 * playlist and track ids.
 */
export function failureDetail(error: unknown): unknown {
  if (DEVELOPMENT) return error;
  return error instanceof Error ? error.name : typeof error;
}
