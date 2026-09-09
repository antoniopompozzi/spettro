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
  /**
   * The cover's dominant chromatic colour as `#RRGGBB` — a colour that is
   * actually in the artwork, not an average of it.
   */
  color: string;
  /** OKLCH hue in degrees; `null` for a cover with no meaningful hue. */
  hue?: number | null;
  /** Mean OKLab lightness of the whole cover, 0..1. Orders within a hue band. */
  lightness?: number;
  /**
   * Rounded tempo from ReccoBeats. `null` means nobody knows it — never `0`,
   * which would read as a real measurement. Such a track stays in the sequence
   * and simply sits out any rhythmic comparison.
   */
  bpm?: number | null;
  /** Spotify album art at the size the grid needs. */
  coverUrl?: string | null;
  /** The track on Spotify: every datum shown has to lead back to the service. */
  spotifyUrl?: string | null;
  explicit?: boolean;
  /** The full ReccoBeats reading, kept for Discover; `null` when it has none. */
  features?: AudioFeatures | null;
}

/** A track placed in the spectrum sequence, `position` being its 0-based rank. */
export interface SequencedTrack extends Track {
  position: number;
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

/**
 * One seed as the client sends it. `artist` and `spotifyId` arrive together
 * from a resolved pick; a seed typed as a bare title has neither, and the
 * server resolves it against Spotify before anything else can happen — Last.fm
 * is addressed by artist and title, and a colour needs a record to read.
 */
export interface DiscoverSeed {
  title: string;
  artist?: string;
  spotifyId?: string;
}

/** A seed once Spettro knows which record it is, echoed back for the read-out. */
export interface ResolvedSeed {
  title: string;
  artist: string;
  spotifyId: string;
  color: string;
  bpm: number | null;
}

/** A suggestion, with the two numbers that decided its rank kept on it. */
export interface Suggestion extends Track {
  /** How many of the seeds Last.fm named this track for. The first sort key. */
  seedMatches: number;
  /** Mean OKLab distance to the seeds that named it. The second sort key. */
  colourDistance: number;
}

/**
 * What `POST /api/discover` answers with.
 *
 * `meta` is the funnel, stage by stage. Almost every stage removes candidates,
 * and when twenty come back as three the answer is always "at which stage" —
 * a question that otherwise costs a round of temporary logging to ask.
 */
export interface DiscoverResponse {
  results: Suggestion[];
  seeds: ResolvedSeed[];
  meta: {
    /** Seeds asked for, and how many became a Spotify record. */
    seedsGiven: number;
    seedsResolved: number;
    /** Seeds ReccoBeats had a tempo for — how many the average speaks for. */
    seedsWithTempo: number;
    /** Names returned by Last.fm, summed over seeds, before de-duplication. */
    candidates: number;
    /** Distinct names left after de-duplication across seeds. */
    unique: number;
    /** Of those, how many were looked up — the rest fell outside the ceiling. */
    considered: number;
    /** Looked up and confidently matched to a Spotify record. */
    resolved: number;
    /** Looked up and dropped: no confident match, or the seed's own record. */
    unresolved: number;
    /** Resolved but dropped because their artwork yielded no colour. */
    withoutColour: number;
    /** Excluded by the tempo filter. Zero when no seed had a tempo to filter on. */
    filteredByTempo: number;
    /** Ranked and returned. */
    returned: number;
    /** Of those returned, how many carry a tempo and how many do not. */
    withTempo: number;
    withoutTempo: number;
  };
}
