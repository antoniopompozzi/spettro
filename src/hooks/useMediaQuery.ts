'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Matches a media query on the client. Renders as `false` on the server, which
 * is safe here: everything that depends on it only appears after a user action.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Columns in the serpentine cover grid. Mirrors the 761px CSS breakpoint. */
export function useGridColumns(): number {
  return useMediaQuery('(min-width: 761px)') ? 7 : 3;
}
