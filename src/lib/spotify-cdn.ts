/**
 * Artwork may only come from Spotify's own CDN.
 *
 * Two reasons, one of each kind. The Design Guidelines allow only
 * Spotify-supplied artwork beside Spotify metadata, so a URL from anywhere else
 * is a licence problem before it is a security one. And these URLs are read out
 * of a JSON body and then handed to `fetch` on the server and to `src` in the
 * browser: a field that reaches both without being checked is a field worth
 * checking, whatever we believe the upstream sends today.
 *
 * The host allowlist is the `scdn.co` family — album art is served from
 * `i.scdn.co`, playlist mosaics from `mosaic.scdn.co` — and the scheme must be
 * https, so a redirect to plain http cannot smuggle one through.
 */
const CDN_SUFFIX = '.scdn.co';

export function isSpotifyImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  // `endsWith` alone would accept `evil-scdn.co`; the dot has to be part of it.
  return url.hostname === 'scdn.co' || url.hostname.endsWith(CDN_SUFFIX);
}

/** The URL if Spotify's CDN serves it, `null` otherwise. */
export function spotifyImageUrl(value: unknown): string | null {
  return isSpotifyImageUrl(value) ? value : null;
}
