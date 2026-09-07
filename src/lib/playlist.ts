const SPOTIFY_PLAYLIST = /open\.spotify\.com\/playlist\/[A-Za-z0-9]+/i;

/** Loose client-side check; the real resolution happens once the API lands. */
export function isSpotifyPlaylistUrl(value: string): boolean {
  return SPOTIFY_PLAYLIST.test(value.trim());
}
