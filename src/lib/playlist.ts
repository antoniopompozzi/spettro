const SPOTIFY_PLAYLIST = /open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i;

/** Loose client-side check, mirrored by the API route before it calls Spotify. */
export function isSpotifyPlaylistUrl(value: string): boolean {
  return SPOTIFY_PLAYLIST.test(value.trim());
}

/** The base-62 id out of a playlist link, or `null` if the link is not one. */
export function spotifyPlaylistId(value: string): string | null {
  return SPOTIFY_PLAYLIST.exec(value.trim())?.[1] ?? null;
}
