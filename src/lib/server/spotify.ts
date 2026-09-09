import 'server-only';

import { isConfidentMatch } from '@/lib/match';
import type { SeedSuggestion } from '@/lib/types';
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

/**
 * Every page after the first is fetched from a URL that arrived inside the
 * previous page's JSON — and it is fetched carrying the listener's access
 * token. A `next` pointing anywhere else would hand that token to whoever it
 * pointed at, so the host is checked rather than trusted.
 */
function isSpotifyApiUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'api.spotify.com';
  } catch {
    return false;
  }
}

async function readPage(url: string): Promise<ItemPage> {
  if (!isSpotifyApiUrl(url)) {
    throw new OrderError(502, 'Spotify answered with something Spettro could not follow.');
  }

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

/**
 * Spotify caps this app's search at ten results however many are asked for —
 * a development-mode limit on the app, not a parameter. Asking for exactly ten
 * keeps the request honest about what will come back.
 */
const SEARCH_LIMIT = 10;

/**
 * Spotify's query parser reads `:` as a field filter and `"` as a phrase, so a
 * title carrying either would search for something other than itself.
 */
const stripQuerySyntax = (value: string): string =>
  value.replace(/["':]/g, ' ').replace(/\s+/g, ' ').trim();

interface SearchResponse {
  tracks?: { items?: SpotifyObject[] };
}

/**
 * The outcome of one lookup, which has two failures that look alike and mean
 * opposite things.
 *
 * `track: null` with `reached: true` is Spotify answering that it has nothing
 * matching — a fact about the catalogue. `reached: false` is the search never
 * completing: a 502, a timeout, a connection that went nowhere. Collapsing them
 * into one `null` is how a transient outage ends up telling somebody to check
 * their spelling.
 */
export interface SearchResult {
  track: SpotifyTrack | null;
  reached: boolean;
}

/**
 * One call to `/v1/search`, shared by everything that needs it.
 *
 * There is one request here and two very different readings of its answer. The
 * engine wants the single record a name refers to and checks the match itself;
 * the seed picker wants the whole list, because a person looking at ten covers
 * is a better judge than any string comparison. Both must ask Spotify the same
 * way, or a seed picked from the list could resolve differently from the same
 * seed typed as text.
 */
async function runSearch(
  terms: string,
): Promise<{ items: SpotifyObject[]; reached: boolean }> {
  const url = `${API_BASE}/search?${new URLSearchParams({
    q: terms,
    type: 'track',
    limit: String(SEARCH_LIMIT),
  })}`;

  try {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${await userAccessToken()}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // These two are true of the whole run, not of this candidate: failing them
    // quietly would empty the pool one silent drop at a time.
    if (response.status === 401) {
      throw new OrderError(401, 'That Spotify connection has expired. Connect your account again.');
    }
    if (response.status === 429) {
      throw new OrderError(429, 'Spotify is rate-limiting us right now. Try again in a minute.');
    }
    if (!response.ok) {
      console.warn(`[spotify] search answered ${response.status}`);
      return { items: [], reached: false };
    }
    const page = (await response.json()) as SearchResponse;
    return { items: page.tracks?.items ?? [], reached: true };
  } catch (cause) {
    if (cause instanceof OrderError) throw cause;
    console.warn('[spotify] search failed to reach the API');
    return { items: [], reached: false };
  }
}

/**
 * The one track in Spotify's catalogue that a title and artist name, or `null`.
 *
 * This is the bridge Discover stands on: Last.fm answers in text, and a colour
 * and a tempo can only be read once that text is a Spotify id. Everything the
 * ranking uses afterwards comes from the record this picks, so picking the
 * wrong one is not a cosmetic error — it hands a candidate somebody else's
 * artwork and ranks it on the colour of that.
 *
 * Hence the check on the way out. Spotify's search always answers something,
 * ordered by popularity, so the top hit for a title it does not have is simply
 * the most popular track that shares a word with it. Results are taken in the
 * order Spotify ranks them and the first confident match wins; if none of the
 * ten is confident, the candidate is dropped rather than kept on the best of a
 * bad set.
 *
 * `artist` is optional because a seed typed by hand is only a title. Without one
 * there is nothing to cross-check against, so the title alone has to carry the
 * match and Spotify's own popularity ordering breaks the tie — which is the
 * behaviour a person typing a bare song title expects.
 */
export async function searchTrack(title: string, artist?: string): Promise<SearchResult> {
  const terms = stripQuerySyntax(artist ? `${title} ${artist}` : title);
  // An empty query is a fact about the input, not a failure to reach anything.
  if (!terms) return { track: null, reached: true };

  const { items, reached } = await runSearch(terms);
  if (!reached) return { track: null, reached: false };

  for (const found of items) {
    const credited = found?.artists?.[0]?.name;
    if (!found?.id || !found.name || !credited) continue;
    if (!isConfidentMatch({ title, artist: artist ?? credited }, { title: found.name, artist: credited })) {
      continue;
    }

    const images = found.album?.images;
    return {
      track: {
        id: found.id,
        spotifyId: found.id,
        title: found.name,
        artist: credited,
        cover: pickCover(images, DISPLAY_COVER_WIDTH),
        swatch: pickCover(images, SWATCH_COVER_WIDTH),
        spotifyUrl: found.external_urls?.spotify ?? null,
        explicit: found.explicit === true,
      },
      reached: true,
    };
  }
  // Spotify answered; none of its ten was confidently the track asked for.
  return { track: null, reached: true };
}

/** Spotify's base-62 ids are 22 characters. Checked before it reaches a URL path. */
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
export const isSpotifyTrackId = (value: string): boolean => SPOTIFY_ID.test(value);

/**
 * One track by its id, for a seed that arrives already picked.
 *
 * Searching again for a seed whose id is known would be worse than wasteful:
 * search answers by popularity, so it could hand back a different record from
 * the one the listener chose — a remaster, a compilation issue, a live take —
 * with different artwork and therefore a different colour to compare against.
 */
export async function fetchTrack(spotifyId: string): Promise<SpotifyTrack | null> {
  if (!isSpotifyTrackId(spotifyId)) return null;

  let found: SpotifyObject;
  try {
    const response = await fetch(`${API_BASE}/tracks/${spotifyId}`, {
      headers: { authorization: `Bearer ${await userAccessToken()}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 401) {
      throw new OrderError(401, 'That Spotify connection has expired. Connect your account again.');
    }
    if (response.status === 429) {
      throw new OrderError(429, 'Spotify is rate-limiting us right now. Try again in a minute.');
    }
    if (!response.ok) {
      console.warn(`[spotify] track lookup answered ${response.status}`);
      return null;
    }
    found = (await response.json()) as SpotifyObject;
  } catch (cause) {
    if (cause instanceof OrderError) throw cause;
    console.warn('[spotify] track lookup failed to reach the API');
    return null;
  }

  const credited = found?.artists?.[0]?.name;
  if (!found?.id || !found.name || !credited) return null;

  const images = found.album?.images;
  return {
    id: found.id,
    spotifyId: found.id,
    title: found.name,
    artist: credited,
    cover: pickCover(images, DISPLAY_COVER_WIDTH),
    swatch: pickCover(images, SWATCH_COVER_WIDTH),
    spotifyUrl: found.external_urls?.spotify ?? null,
    explicit: found.explicit === true,
  };
}

/**
 * The thumbnail the seed picker shows. Rows are 40px, so the smallest rung of
 * Spotify's ladder is already generous, and thirty of them can be in flight
 * across three open slots — the 300px copy would be forty times the bytes for
 * a picture the size of a fingernail.
 */
const THUMB_COVER_WIDTH = 64;

/**
 * Everything Spotify offers for a query, in its own order, unfiltered.
 *
 * Deliberately *not* passed through `isConfidentMatch`. That test exists
 * because the engine has to decide alone whether a name Last.fm supplied is the
 * record it meant; here a person is looking at ten covers and deciding for
 * themselves, and a string comparison second-guessing them would only hide the
 * track they were reaching for. Half-typed queries are the normal case and
 * would fail it constantly.
 */
export async function searchSuggestions(query: string): Promise<SeedSuggestion[]> {
  const terms = stripQuerySyntax(query);
  if (!terms) return [];

  const { items } = await runSearch(terms);
  return items.flatMap((found) => {
    const credited = found?.artists?.[0]?.name;
    if (!found?.id || !found.name || !credited) return [];
    return [
      {
        spotifyId: found.id,
        title: found.name,
        artist: credited,
        thumb: pickCover(found.album?.images, THUMB_COVER_WIDTH),
        explicit: found.explicit === true,
      },
    ];
  });
}
