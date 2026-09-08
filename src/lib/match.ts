/**
 * Deciding whether two names refer to the same recording.
 *
 * Last.fm answers with a title and an artist as text, and the only way back to
 * a Spotify id — and so to a cover and a tempo — is to search that text and
 * judge what comes back. The catalogues disagree constantly on spelling:
 * `Sunday Bloody Sunday - Remastered 2008`, `Rock the Casbah (Live)`,
 * `Beyoncé` against `Beyonce`, `Jay-Z & Kanye West` against `JAY-Z`. None of
 * those is a different song, and all of them fail an equality test.
 *
 * So a name is reduced to the words that carry its identity, and two names are
 * compared on how many of those words they share. Wrongly accepting is the
 * expensive error: a candidate kept on a bad match gets a cover and a tempo
 * that belong to a different record, and its colour then decides where it ranks.
 * Discarding a real track only costs one line of a list of twenty.
 */

/**
 * The words that mark a release variant rather than a different song. A trailing
 * `- …` clause is only cut when it contains one of these: plenty of titles use a
 * dash of their own, and `Us and Them - Portrait of a Marriage` is not an edition.
 */
const EDITION_WORDS =
  /\b(remaster|remastered|live|version|edit|mix|remix|mono|stereo|deluxe|radio|single|album|bonus|acoustic|instrumental|demo|anniversary|reissue|expanded|explicit|clean)\b/;

/** Featured-artist clauses: the same recording is credited both ways. */
const FEATURING = /\s*[([]?\s*\b(feat|ft|featuring|with)\b\.?\s.*$/;

/**
 * A name reduced to its identifying words: lower case, accents folded, edition
 * and featuring clauses dropped, punctuation gone.
 *
 * Bracketed trailers go unconditionally — `(Remastered)`, `(Live at Wembley)`,
 * `[Explicit]` — because a bracket at the end of a title is a note about the
 * release in practice, never the subject of the song.
 */
export function normalise(value: string): string {
  const folded = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const withoutBrackets = folded.replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ');
  const withoutFeature = withoutBrackets.replace(FEATURING, '');

  // Only the last dash clause, and only when it names an edition.
  const dash = withoutFeature.lastIndexOf(' - ');
  const trimmed =
    dash > 0 && EDITION_WORDS.test(withoutFeature.slice(dash))
      ? withoutFeature.slice(0, dash)
      : withoutFeature;

  return trimmed
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Articles carry no identity in a name, and leaving them in lets two unrelated
 * names share a word for free: `The Beatles` against `The Carpenters` scores
 * half its words identical on `the` alone. They are dropped for scoring only —
 * a name made of nothing else keeps them, so `The The` still compares to itself.
 */
const ARTICLES = new Set(['the', 'a', 'an']);

function tokens(value: string): Set<string> {
  const all = normalise(value).split(' ').filter(Boolean);
  const carrying = all.filter((word) => !ARTICLES.has(word));
  return new Set(carrying.length > 0 ? carrying : all);
}

/**
 * How much two names overlap, 0 to 1 — the Dice coefficient over their words.
 *
 * Word sets rather than characters, because the differences that matter here
 * are whole words added or dropped (`the`, a featured artist, a subtitle) and
 * not letters changed. Order is ignored, which is what makes `JAY-Z & Kanye
 * West` and `Kanye West, JAY-Z` the same credit.
 */
export function similarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return (2 * shared) / (left.size + right.size);
}

/**
 * Whether one name is the other with words to spare — `JAY-Z` inside
 * `JAY-Z & Kanye West`, or `Tyler` inside `Tyler, The Creator`.
 *
 * Credits are truncated and expanded far more often than they are misspelled,
 * and that asymmetry is invisible to a symmetric score: a one-word artist
 * against a three-word one scores 0.5 however right it is. This is why the test
 * exists, and also why it is applied to the artist and never to the title —
 * see `isConfidentMatch`.
 */
function contains(a: string, b: string): boolean {
  const [left, right] = [normalise(a), normalise(b)];
  if (!left || !right) return false;
  const [short, long] = left.length <= right.length ? [left, right] : [right, left];
  return long === short || long.startsWith(`${short} `) || long.endsWith(` ${short}`) ||
    long.includes(` ${short} `);
}

/**
 * Tuning knobs, judged by eye against real search results and deliberately
 * strict. The title bar is the higher of the two because a wrong title is a
 * different song, while a thin artist match is usually a credit written two
 * ways for the same recording.
 */
export const TITLE_MIN = 0.7;
export const ARTIST_MIN = 0.5;

export interface NamedTrack {
  title: string;
  artist: string;
}

/**
 * Whether a search result is the track that was asked for, confidently enough
 * to read a colour and a tempo off it and rank a listener's suggestions by them.
 *
 * Both halves have to agree. Title alone would accept another artist's cover
 * version, which has its own artwork and its own tempo and is a different
 * record; artist alone would accept any other song they released.
 */
export function isConfidentMatch(want: NamedTrack, got: NamedTrack): boolean {
  // Containment is right for a credit and wrong for a title. A title swallowed
  // by a longer one is usually a different song — `Yesterday` sits inside
  // `Yesterday Once More`, which the Carpenters wrote and the Beatles did not —
  // and the variants containment would have caught here are the ones
  // `normalise` has already removed: the remaster, the live take, the edit.
  const titleFits = similarity(want.title, got.title) >= TITLE_MIN;
  const artistFits =
    contains(want.artist, got.artist) || similarity(want.artist, got.artist) >= ARTIST_MIN;
  return titleFits && artistFits;
}
