export interface Track {
  id: string;
  title: string;
  artist: string;
  /** Dominant cover colour as `#RRGGBB`. Mocked until colour extraction lands. */
  color: string;
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
