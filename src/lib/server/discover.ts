import 'server-only';

import { oklabDistance, type Oklch } from '@/lib/color';
import { normalise, type NamedTrack } from '@/lib/match';
import type { DiscoverResponse, DiscoverSeed, ResolvedSeed, Suggestion } from '@/lib/types';

import { mapLimit } from './concurrency';
import { coverColour, type CoverColour } from './cover';
import { OrderError } from './errors';
import { fetchSimilar } from './lastfm';
import { debug } from './log';
import { fetchAudioFeatures } from './reccobeats';
import { COVER_CONCURRENCY } from './sequence';
import { fetchTrack, searchTrack, type SpotifyTrack } from './spotify';

/**
 * Suggestions shown.
 *
 * Five, down from twenty. Everything upstream is still sized for the larger
 * number and deliberately so: the pool is what the ranking chooses from, and
 * cutting it would change which five come out, not just how many are printed.
 * The cost of that is real and worth naming — `RESOLVE_LIMIT` candidates are
 * still searched and their covers still read to produce a list of five.
 */
const RESULT_LIMIT = 5;

/**
 * How many distinct candidate names are looked up on Spotify.
 *
 * Three seeds can name ninety tracks, and each one costs a search and a cover
 * download — the same work Order does for a whole playlist, on top of resolving
 * the seeds. Sixty is three times what is shown, which leaves room for the
 * drops that follow without making one press of Find the most expensive thing
 * this app does. Candidates are ranked by how many seeds named them before the
 * cut, so what falls outside it is what would have ranked last anyway: the
 * ceiling and the first sort key are the same measure.
 */
const RESOLVE_LIMIT = 60;

/** Spotify searches in flight. The CDN's own ceiling is `COVER_CONCURRENCY`. */
const SEARCH_CONCURRENCY = 4;

/**
 * How far a candidate's tempo may sit from the seeds' average, as a fraction of
 * it.
 *
 * A coarse filter and not a ranking term: its job is to drop the pairing that is
 * absurd on its face, and ranking stays with the colour, which is what Spettro
 * is about.
 *
 * How coarse it actually is depends on the seeds, and measurement says so more
 * plainly than the number does. A relative tolerance is a narrow window at a low
 * tempo and a wide one at a high tempo — 25% of 75 is ±19 BPM, 25% of 155 is
 * ±39 — and octave ambiguity lands squarely in the gap. ReccoBeats reports one
 * of two readings a beat apart for the same groove, so at a slow seed every
 * candidate it read at the doubled octave is 100% away and goes. Measured on one
 * seed each: `Karma Police` at 75 BPM dropped 22 of 30 and returned 8; `Sicko
 * Mode` at 155 dropped 6 and returned a full 20; `Blinding Lights` at 171
 * dropped 18 and returned 12. Three seeds average out and behave: 26 of 57
 * dropped, 20 returned.
 *
 * Left at 25% regardless, and deliberately. The fix that suggests itself is
 * octave normalisation, and that is a standing product decision in the other
 * direction: a drum and bass track at 170 and a hip hop track at 85 are
 * genuinely different, and folding them together would let the filter pass
 * exactly the pairings it exists to catch. The other fix is a wider tolerance,
 * which would be a constant tuned to three seeds — the mistake AGENTS.md records
 * the neutral gate making. A single slow seed returning eight suggestions is the
 * honest cost of both refusals, not an oversight.
 */
const TEMPO_TOLERANCE = 0.25;

/** A candidate as Last.fm named it, with which seeds named it. */
interface Candidate extends NamedTrack {
  /** Indices into the seed list. Its size is the first sort key. */
  seeds: Set<number>;
}

/** A seed once it is a record with a colour and a tempo to compare against. */
interface Seeded {
  track: SpotifyTrack;
  colour: CoverColour;
  bpm: number | null;
}

const colourOf = (colour: CoverColour): Oklch => ({
  lightness: colour.lightness,
  chroma: colour.chroma,
  hue: colour.hue,
});

/**
 * Same title, same artist, however either was spelled or punctuated.
 *
 * The separator has to be a character `normalise` can never emit, or the key is
 * ambiguous: it reduces a name to `[a-z0-9 ]`, so joining on a space alone would
 * let `Blue Monday` by `New Order` collide with `Blue` by `Monday New Order`.
 * A pipe cannot survive normalisation, so it cannot arrive from either name.
 */
const nameKey = (track: NamedTrack): string =>
  `${normalise(track.title)}|${normalise(track.artist)}`;

/**
 * Turns the seeds the client sent into records: by id when the pick carried
 * one, by search when it was typed as a bare title.
 *
 * A seed that resolves to nothing is dropped rather than fatal, the same way an
 * unrecognised seed is at Last.fm. Two seeds out of three still describe a
 * region of colour, and refusing the whole request over one misspelling would
 * be the wrong trade for the person who typed it.
 */
async function resolveSeeds(
  given: readonly DiscoverSeed[],
): Promise<{ seeds: SpotifyTrack[]; reachedSpotify: boolean }> {
  const found = await mapLimit(given, SEARCH_CONCURRENCY, async (seed) => {
    if (seed.spotifyId) {
      const byId = await fetchTrack(seed.spotifyId);
      if (byId) return { track: byId, reached: true };
    }
    return await searchTrack(seed.title, seed.artist);
  });

  const seeds: SpotifyTrack[] = [];
  const seen = new Set<string>();
  for (const { track } of found) {
    // The same record twice would count itself twice in `seedMatches` and pull
    // the ranking towards one seed for no reason the listener asked for.
    if (!track?.spotifyId || seen.has(track.spotifyId)) continue;
    seen.add(track.spotifyId);
    seeds.push(track);
  }
  return { seeds, reachedSpotify: found.some((outcome) => outcome.reached) };
}

/** Every name Last.fm returns for any seed, de-duplicated, keeping who named it. */
async function collectCandidates(
  seeds: readonly SpotifyTrack[],
): Promise<{ candidates: Candidate[]; raw: number }> {
  const perSeed = await Promise.all(seeds.map((seed) => fetchSimilar(seed)));

  const byName = new Map<string, Candidate>();
  let raw = 0;
  perSeed.forEach((similar, index) => {
    raw += similar.length;
    for (const named of similar) {
      const key = nameKey(named);
      const existing = byName.get(key);
      if (existing) existing.seeds.add(index);
      else byName.set(key, { ...named, seeds: new Set([index]) });
    }
  });

  return { candidates: [...byName.values()], raw };
}

/**
 * The mean tempo of the seeds that have one.
 *
 * `null` when none of them does, and then the filter does not run at all: with
 * nothing to compare against, dropping candidates on tempo would be dropping
 * them on noise. ReccoBeats has no reading for a fair share of any catalogue,
 * so this is a normal outcome and not a failure.
 */
function seedTempo(seeds: readonly Seeded[]): number | null {
  const known = seeds.map((seed) => seed.bpm).filter((bpm): bpm is number => bpm !== null);
  if (known.length === 0) return null;
  return known.reduce((sum, bpm) => sum + bpm, 0) / known.length;
}

/**
 * Suggestions for one to three seeds, ranked by the same colour identity Order
 * lays a playlist out along.
 *
 * The shape of it: Last.fm names a pool, Spotify turns each name into a record,
 * and every judgement after that is Spettro's own. A candidate is close to a
 * seed when the dominant colour of its artwork is close to the seed's — the
 * same dominant-cluster colour Order sorts by, read by the same code — and its
 * rank is that distance, averaged over the seeds that named it.
 *
 * Agreement between seeds outranks colour. A track two seeds both point at is
 * about both of them, and the listener chose more than one seed to say so; a
 * track only one seed named can be closer in colour and still be the answer to
 * a narrower question. So the count sorts first and the distance breaks its ties.
 */
export async function discover(given: readonly DiscoverSeed[]): Promise<DiscoverResponse> {
  const { seeds: seedTracks, reachedSpotify } = await resolveSeeds(given);
  if (seedTracks.length === 0) {
    // Measured in the wild: Spotify's search answered 502 to all three seeds of
    // a run whose titles were spelled perfectly. Told apart, because otherwise
    // an outage on their side reads as a spelling mistake on the listener's,
    // and the two ask for opposite things to be done next.
    throw reachedSpotify
      ? new OrderError(
          422,
          'Spotify has nothing matching those titles. Check the spelling, or try a different song.',
        )
      : new OrderError(
          502,
          'Spotify did not answer when Spettro looked those songs up. Nothing is wrong with what you typed — try again in a moment.',
        );
  }

  const { candidates, raw } = await collectCandidates(seedTracks);

  // Named by more seeds first, so the ceiling cuts what would have ranked last
  // anyway. Ties keep Last.fm's order, which keeps two runs of the same seeds
  // identical — the determinism Order's clustering is held to.
  const ordered = candidates.sort((a, b) => b.seeds.size - a.seeds.size);
  const considered = ordered.slice(0, RESOLVE_LIMIT);

  const seedIds = new Set(seedTracks.map((seed) => seed.spotifyId));
  const matched = await mapLimit(considered, SEARCH_CONCURRENCY, async (candidate) => {
    const { track, reached } = await searchTrack(candidate.title, candidate.artist);
    return { candidate, track, reached };
  });

  // A candidate whose lookup never completed is dropped like any other, because
  // dozens are looked up and losing a few to a hiccup is normal. It is counted
  // apart from a confident miss all the same: the two say different things
  // about a run that came back short.
  const unreachable = matched.filter((entry) => !entry.reached).length;

  const resolved: Array<{ candidate: Candidate; track: SpotifyTrack }> = [];
  const seenIds = new Set<string>();
  for (const entry of matched) {
    if (!entry?.track?.spotifyId) continue;
    // A seed is not a suggestion, and two Last.fm names routinely resolve to the
    // same record — one song credited two ways is one row, not two.
    if (seedIds.has(entry.track.spotifyId) || seenIds.has(entry.track.spotifyId)) continue;
    seenIds.add(entry.track.spotifyId);
    resolved.push({ candidate: entry.candidate, track: entry.track });
  }

  // Both sides of every comparison come from the same two sources, read by the
  // same code: one tempo lookup covering seeds and candidates together, and the
  // cover reader Order uses.
  const features = await fetchAudioFeatures(
    [
      ...seedTracks.map((seed) => seed.spotifyId),
      ...resolved.map((entry) => entry.track.spotifyId),
    ].filter((id): id is string => Boolean(id)),
  );

  const tempoOf = (track: SpotifyTrack): number | null => {
    const audio = track.spotifyId ? features.get(track.spotifyId) : undefined;
    return audio?.tempo == null ? null : Math.round(audio.tempo);
  };

  const readCover = async (track: SpotifyTrack): Promise<CoverColour | null> => {
    const swatch = track.swatch ?? track.cover;
    return swatch ? await coverColour(swatch) : null;
  };

  const seedColours = await mapLimit(seedTracks, COVER_CONCURRENCY, readCover);
  const seeded: Seeded[] = [];
  /** Where each original seed landed once unreadable covers are out of the list. */
  const seedIndex = new Map<number, number>();
  seedTracks.forEach((track, index) => {
    const colour = seedColours[index];
    if (!colour) {
      debug(`[discover] no cover colour for seed "${track.title}" — ${track.artist}`);
      return;
    }
    seedIndex.set(index, seeded.length);
    seeded.push({ track, colour, bpm: tempoOf(track) });
  });
  if (seeded.length === 0) {
    throw new OrderError(
      422,
      'None of those covers could be read, so there is no colour to search from. Try a different song.',
    );
  }

  const covers = await mapLimit(resolved, COVER_CONCURRENCY, (entry) => readCover(entry.track));

  const average = seedTempo(seeded);
  let withoutColour = 0;
  let filteredByTempo = 0;
  const ranked: Suggestion[] = [];

  resolved.forEach(({ candidate, track }, index) => {
    const colour = covers[index];
    if (!colour) {
      withoutColour += 1;
      return;
    }

    const bpm = tempoOf(track);
    // Only a tempo that exists can disagree. A candidate ReccoBeats has never
    // heard of stays in and competes on colour alone, exactly as a track with no
    // tempo keeps its place in an Order sequence.
    if (average !== null && bpm !== null && Math.abs(bpm - average) / average > TEMPO_TOLERANCE) {
      filteredByTempo += 1;
      return;
    }

    // Measured against the seeds that named it, not against all of them: a seed
    // that never proposed this track has no opinion about it, and averaging its
    // distance in would rank the candidate on a comparison nobody asked for.
    const against = [...candidate.seeds]
      .map((i) => seedIndex.get(i))
      .filter((i): i is number => i !== undefined);
    // Every seed that named it had its cover fail, so fall back to all of them
    // rather than dividing by nothing.
    const measured = against.length > 0 ? against : seeded.map((_, i) => i);
    const distance =
      measured.reduce(
        (sum, i) => sum + oklabDistance(colourOf(colour), colourOf(seeded[i].colour)),
        0,
      ) / measured.length;

    ranked.push({
      id: track.spotifyId ?? track.id,
      title: track.title,
      artist: track.artist,
      color: colour.color,
      hue: colour.hue,
      lightness: colour.lightness,
      bpm,
      coverUrl: track.cover,
      spotifyUrl: track.spotifyUrl,
      explicit: track.explicit,
      features: track.spotifyId ? (features.get(track.spotifyId) ?? null) : null,
      seedMatches: measured.length,
      colourDistance: distance,
    });
  });

  const results = ranked
    .sort((a, b) =>
      b.seedMatches !== a.seedMatches
        ? b.seedMatches - a.seedMatches
        : a.colourDistance - b.colourDistance,
    )
    .slice(0, RESULT_LIMIT);

  const seeds: ResolvedSeed[] = seeded.map(({ track, colour, bpm }) => ({
    title: track.title,
    artist: track.artist,
    spotifyId: track.spotifyId ?? '',
    color: colour.color,
    bpm,
  }));

  const withTempo = results.filter((result) => result.bpm !== null).length;
  return {
    results,
    seeds,
    meta: {
      seedsGiven: given.length,
      seedsResolved: seeded.length,
      seedsWithTempo: seeded.filter((seed) => seed.bpm !== null).length,
      candidates: raw,
      unique: candidates.length,
      considered: considered.length,
      resolved: resolved.length,
      unresolved: considered.length - resolved.length,
      unreachable,
      withoutColour,
      filteredByTempo,
      returned: results.length,
      withTempo,
      withoutTempo: results.length - withTempo,
    },
  };
}
