/**
 * The Spotify-style audio features, which Spotify itself no longer serves.
 * Only `tempo` is read today; the rest is kept for Discover, and costs nothing
 * extra because it arrives in the same response.
 */
export interface AudioFeatures {
  /** Beats per minute, or `null` when ReccoBeats has no reading for the track. */
  tempo: number | null;
  acousticness: number | null;
  danceability: number | null;
  energy: number | null;
  instrumentalness: number | null;
  key: number | null;
  liveness: number | null;
  loudness: number | null;
  mode: number | null;
  speechiness: number | null;
  valence: number | null;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  /** Dominant cover colour as `#RRGGBB`, read off the artwork server-side. */
  color: string;
  /**
   * Rounded tempo from ReccoBeats. `null` means nobody knows it — never `0`,
   * which would read as a real measurement. Such a track stays in the sequence
   * and simply sits out any rhythmic comparison.
   */
  bpm?: number | null;
  /** Spotify album art at the size the grid needs. */
  coverUrl?: string | null;
  /** The full ReccoBeats reading, kept for Discover; `null` when it has none. */
  features?: AudioFeatures | null;
}

/** A track placed in the spectrum sequence, `position` being its 0-based rank. */
export interface SequencedTrack extends Track {
  position: number;
}

export interface Recommendation extends Track {
  bpm: number;
}

export interface Stat {
  label: string;
  value: string;
}

/** One of the three Discover seed slots; `null` while empty. */
export type Seed = { title: string } | null;

export type OrderPhase = 'empty' | 'processing' | 'result';

/** What `POST /api/order` answers with once a playlist has been sequenced. */
export interface OrderResponse {
  tracks: Track[];
  meta: {
    /** Playable tracks found in the playlist. */
    total: number;
    /** Tracks that made it into the sequence. */
    sequenced: number;
    /** Dropped because their artwork yielded no colour. */
    dropped: number;
    /** Sequenced tracks ReccoBeats had a tempo for. */
    withTempo: number;
    /** Sequenced tracks with no tempo from anyone: present, but not comparable. */
    withoutTempo: number;
  };
}
