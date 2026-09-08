import 'server-only';

import { isSpotifyImageUrl } from '@/lib/spotify-cdn';

import { OrderError } from './errors';
import { userAccessToken } from './spotify-auth';

const API_BASE = 'https://api.spotify.com/v1';
const TIMEOUT_MS = 10_000;
const PAGE_SIZE = 50;

export interface SpotifyTrack {
  /** Playlist-unique: a playlist may hold the same track more than once. */
  id: string;
  /** The base-62 track id, which is also how ReccoBeats is addressed. */
  spotifyId: string | null;
  title: string;
  artist: string;
  /** Album art from Spotify, the only artwork this app is allowed to show. */
  cover: string | null;
  /** A smaller copy of the same art, enough to read a colour from. */
  swatch: string | null;
  /** Where the track lives on Spotify; every shown datum must lead back there. */
  spotifyUrl: string | null;
  explicit: boolean;
}

/**
 * The artwork is the content here, not decoration, so the grid gets the large
 * rung of Spotify's ladder (typically 640 / 300 / 64): tiles are around 185 CSS
 * px, which a 300px image renders soft on a high-density screen.
 */
const DISPLAY_COVER_WIDTH = 640;
/**
 * Colour extraction reads a smaller copy of the same image. The dominant colour
 * does not change with scale, and the server would otherwise pull four times
 * the bytes per track for no gain.
 */
const SWATCH_COVER_WIDTH = 300;

/** The smallest image at or above `want`, or the largest available if none is. */
function pickCover(
  images: Array<{ url: string; width: number | null }> = [],
  want: number,
): string | null {
  // Anything not served by Spotify's CDN is dropped here, before it can reach
  // the decoder on the server or an `src` in the browser.
  const usable = images.filter((image) => isSpotifyImageUrl(image?.url));
  const sized = usable
    .filter((image): image is { url: string; width: number } => typeof image.width === 'number')
    .sort((a, b) => a.width - b.width);
  return (
    sized.find((image) => image.width >= want)?.url ??
    sized[sized.length - 1]?.url ??
    usable[0]?.url ??
    null
  );
}

interface PlaylistItem {
  /** The current endpoint calls it `item`; the deprecated one called it `track`. */
  item?: SpotifyObject | null;
  track?: SpotifyObject | null;
}

interface SpotifyObject {
  id: string | null;
  name?: string;
  type?: string;
  explicit?: boolean;
  external_urls?: { spotify?: string };
  artists?: Array<{ name: string }>;
  album?: { images?: Array<{ url: string; width: number | null }> };
}

interface ItemPage {
  next: string | null;
  items: PlaylistItem[];
}

async function readPage(url: string): Promise<ItemPage> {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${await userAccessToken()}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (response.ok) return (await response.json()) as ItemPage;

  if (response.status === 401) {
    throw new OrderError(
      401,
      'That Spotify connection has expired. Connect your account again.',
    );
  }
  // Spotify only serves playlist items to the playlist's owner or collaborators,
  // whatever its privacy setting says.
  if (response.status === 403) {
    throw new OrderError(
      403,
      'Spotify only hands over the tracks of playlists you own or collaborate on. This one belongs to someone else.',
    );
  }
  if (response.status === 404) {
    throw new OrderError(404, 'That playlist does not exist, or it is not visible to you.');
  }
  if (response.status === 429) {
    throw new OrderError(429, 'Spotify is rate-limiting us right now. Try again in a minute.');
  }
  throw new OrderError(502, `Spotify answered ${response.status} while reading the playlist.`);
}

/** Every playable track in a playlist, following Spotify's pagination. */
export async function fetchPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];
  let url: string | null = `${API_BASE}/playlists/${playlistId}/items?limit=${PAGE_SIZE}`;

  while (url) {
    const page: ItemPage = await readPage(url);
    for (const entry of page.items ?? []) {
      const track = entry?.item ?? entry?.track;
      const artist = track?.artists?.[0]?.name;
      // Skips podcast episodes, local files and tracks removed from the catalogue.
      if (!track?.name || !artist) continue;
      const images = track.album?.images;
      tracks.push({
        id: `${track.id ?? 'local'}-${tracks.length}`,
        spotifyId: track.id,
        title: track.name,
        artist,
        cover: pickCover(images, DISPLAY_COVER_WIDTH),
        swatch: pickCover(images, SWATCH_COVER_WIDTH),
        spotifyUrl: track.external_urls?.spotify ?? null,
        explicit: track.explicit === true,
      });
    }
    url = page.next;
  }

  return tracks;
}
