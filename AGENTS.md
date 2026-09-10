# SPETTRO

Undergraduate thesis project, Scienze della Comunicazione. It is the **second
practical experiment of a thesis about vibe coding**, so how the work is done is
itself part of the subject matter. **Due 23 September 2026.**

Two modes:

- **ORDER** — reorders one of the listener's own Spotify playlists along a
  colour sequence read off the album artwork. Built and working.
- **DISCOVER** — finds tracks similar to one to three seeds. **Built and
  working.** The similarity engine runs on live Last.fm, Spotify and ReccoBeats
  data, and the seeds are chosen from Spotify's catalogue through a
  search-as-you-type picker, so each one reaches the engine already carrying its
  title, artist and Spotify id.

This file is the handover between sessions. Everything below is something that
cost time to discover or a decision whose reasoning is not visible in the code.
Read it before changing behaviour: several decisions look arbitrary and are not.

---

## Running it

**Open the dev server at `http://127.0.0.1:3000`, never `localhost:3000`.**
Spotify only accepts HTTPS or a numeric loopback redirect URI, so the OAuth
callback lands on 127.0.0.1, and session cookies are scoped to that host.
Cookies do not cross between the two names: on localhost a successful login
still reads as "not connected". `allowedDevOrigins` in `next.config.mjs` exists
for the same reason — without it Next blocks its dev resources and the page
never hydrates.

`http://127.0.0.1:3000/api/spotify/callback` must be registered as a Redirect
URI on the Spotify app, spelled exactly that way.

`SPOTIFY_CLIENT_ID` in `.env.local` is the **only** credential needed. PKCE does
not use a client secret; it was removed. Do not reintroduce one.

Stack: Next 16.3.4 (Turbopack, App Router), React 19, TypeScript 7, Node 24.

`pkill -f "next dev"` does **not** kill the dev server on this machine. Use
PowerShell: `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*next*' } | Stop-Process -Force`,
then check port 3000 is actually free before restarting.

---

## Platform constraints, learned the hard way

**Spotify serves playlist items only to the playlist's owner or a collaborator**
— whatever its privacy setting says. A public playlist belonging to somebody
else is a 403. This is why Order needs a user login at all.

**Client Credentials cannot read a playlist.** Since the 2026 API migration
`/playlists/{id}/tracks` is gone (403 for everyone) and its replacement
`/playlists/{id}/items` answers `401 Valid user authentication required` to app
tokens. Hence Authorization Code + PKCE. When using `fields` on `/items`, the
entry key is `item(...)`, not `track(...)` — the old name silently returns
nothing.

**Spotify's Audio Features and Recommendations endpoints are retired.** Audio
features come from **ReccoBeats** (`https://api.reccobeats.com/v1/audio-features?ids=…`):
no auth, addressed directly with Spotify base-62 track ids, **maximum 40 ids per
call** (44 returns 400), 500ms pacing between calls, honours `Retry-After` on
429. The response's `href` field maps each row back to its Spotify track id.
It also returns energy, danceability, valence, acousticness, instrumentalness,
liveness, loudness, speechiness, key and mode — all kept on `Track.features`,
unused today, and exactly what Discover will need.

**Scopes requested: `playlist-read-private` and `playlist-read-collaborative`,
nothing else.** `user-read-private` was removed because the profile is never
read; keep it removed. Requesting an unused permission would also force the
privacy policy to disclose a collection that never happens.

Spotify search caps this app at `limit=10` (a development-mode signal). This is
no longer hypothetical: Discover resolves every candidate name through
`/v1/search`, so ten is all it ever gets to choose from, and `searchTrack` takes
the first confident match in Spotify's own popularity order.

**Search is called with the listener's token, so Discover needs a sign-in too.**
There is no client secret, so there is no app token to search with. Both modes
now go through `userAccessToken`, which is why its 401 no longer mentions
playlists.

**Spotify's search endpoint answers 502 under no particular load.** It happened
to all three seeds of one verification run whose titles were spelled perfectly.
A lookup that never completed and a lookup that found nothing are different
facts, and `searchTrack` now reports which (`SearchResult.reached`) — collapsing
them into one `null` is how an outage on Spotify's side came out as "check the
spelling" on the listener's. Candidate lookups still drop quietly on a failure,
but are counted apart in `meta.unreachable`.

**One Discover run is expensive enough to trip Spotify's own rate limit, and it
did.** Three seeds means up to 63 calls to `/v1/search` plus 60 covers off the
CDN, and after a session of repeated verification runs Spotify started answering
429 to the first search of a cold server — the app's own limiter reset, the
counter at zero, and still a 429, which is how it was told apart.

**It does not clear in minutes. It cleared in nineteen hours.** The block was
guessed at for most of a session — still refusing after 5 minutes, after 9,
after 20, across dev server restarts — before anything read the header that says
so. `Retry-After` came back **69253 seconds**, a little over nineteen hours.

That number is the reason `spotifyRateLimited` in `src/lib/server/spotify.ts`
exists: it logs the header and puts the real figure in the sentence the listener
reads, because "try again in a minute" is a promise this app cannot keep and had
been making. **Read the header before theorising about the duration** — it was
there the whole time.

**The block is scoped to `/v1/search`, not to the app.** Measured with the same
token in the same session, while search was refusing with 19 hours on the
clock: `/v1/playlists/{id}/items` answered 200 and sequenced a 24-track playlist
in 1.7s with nothing dropped, and `/v1/tracks/{id}` answered fine too — a seed
given by id resolved and Last.fm was reached before search refused again. So
**Order stays completely usable while Discover is blocked**, and it is worth
checking which endpoint is actually refusing before assuming the app is down.

Discover is blocked either way, because candidate resolution goes through
search for every name Last.fm returns, and the seed picker is search itself.

The practical consequence is a budget, not a nuisance. A development-mode app
has roughly one afternoon of hard searching in it per day, and one three-seed
Discover run is 63 searches. Plan verification around that: pace the runs, never
loop them, and prefer stubbing the client's dependency to re-running the real
one for a UI question that does not need it.

Two consequences worth keeping: verification has to be paced and never looped;
and `DISCOVER_LIMIT` at 8 per 5 minutes exists to protect Spotify's quota rather
than this server's, so lowering the app's own ceiling is the lever if a real
listener ever hits theirs. `RESOLVE_LIMIT` at 60 is the other lever and the
cheaper one, since it cuts searches and cover fetches together.

**Last.fm supplies Discover's candidate pool** — `track.getSimilar`, 30 per
seed, `LASTFM_API_KEY` in `.env.local`, no signature needed for a read. Its
`match` score is read and discarded on purpose; see the product decision below.
Error 6 means it has never heard of the track and yields an empty pool, which is
normal and must not be fatal. Errors 10 and 26 mean the key was refused and
**throw**, because a bad key would otherwise look exactly like a run of obscure
seeds: an empty pool every time, with nothing in the log to say why. Even
functional music has neighbours — a brown noise track returned a full 30 — so a
seed with none is genuinely rare, and `Womb Sound Shusher` is the one known
example if the empty state ever needs testing again.

---

## Product decisions, and why

Reversing any of these in good faith is the main risk of a fresh session.

**Cover art comes from Spotify and nowhere else.** Two independent reasons: the
Design Guidelines allow only Spotify-supplied artwork beside Spotify metadata;
and a text search against another catalogue returns whichever release ranks
highest *today* — Deezer offered four different covers among the first six hits
for one track — so the extracted colour and the whole sequence drifted over
time for reasons unrelated to the music.

**Read-only. Spettro never modifies a listener's real playlists.** The sequence
exists on screen; writing it back has never been in scope.

**Ordering walks a fixed list of eleven named bands, not equal slices of the hue
wheel** (`src/lib/spectrum.ts`). A wheel must be cut somewhere, and whatever
straddles the cut tears into two groups at opposite ends of the grid — that
happened to the reds, a crimson at 22° landing a whole grid from a scarlet at
29°. The cut is now at 13°, between pink and red, where the sequence ends
anyway. Band ranges are declared constants meant for tuning by eye.

**Classification and ordering use the dominant colour cluster, never an
average.** Averaging opposing hues yields a colour that is nowhere in the image
— a blue sleeve with a large red face came out dusty mauve — and it put two
obviously blue covers in different halves of the grid. Clustering runs in OKLab
over the chromatic pixels only (blacks and greys have no hue to vote with), and
is **seeded from a histogram, never at random**: two runs of the same playlist
must return byte-identical results, which has been verified.

Averaging in *linear light* is still correct where an average is wanted, because
light adds linearly; sorting uses **OKLab lightness**, which tracks how bright a
colour looks rather than how much light it emits.

**Tempo comes from one source, with no octave normalisation and no fallback.**
Tempo estimation is ambiguous by an octave — 85 and 170 can describe the same
groove — so mixing sources puts tracks on different scales. One source keeps
that error systematic, and relative comparison is what Discover needs. Do not
normalise octaves either: a drum and bass track at 170 and a hip hop track at 85
are genuinely different.

**A track with no tempo keeps `bpm: null`, never `0`.** It stays in the grid and
sits out rhythmic comparison only. Roughly 10-25% of a playlist has no tempo
from anyone. The read-out says how many tracks its figure speaks for.

**Discover ranks on colour, and on nothing anybody else calls similarity.** Two
tracks are neighbours when the dominant colours of their artwork are close — the
same dominant-cluster colour Order sorts by, read by the same `coverColour` —
averaged over the seeds that named the candidate. Last.fm only names the pool,
and ReccoBeats only removes from it. A similarity score from a third party would
make Spettro a wrapper around somebody else's idea of similarity, which is not
the thesis.

**Distance uses the continuous values, never the eleven bands.** A band answers
"where on one line does this cover go": it discards chroma and reduces hue to
which of eleven buckets it fell in, so two covers a degree apart across a border
land in different bands, while a pale cream and a dark olive land in the same
one. Those are exactly the border cases recorded further down this file, and
they are the ones a distance must not be wrong about. `oklabDistance` is plain
Euclidean distance in OKLab, which needs no weights balancing lightness against
chroma against hue, because the space already carries that — and a weight chosen
by hand would be one more constant tuned against one playlist.

**Seed agreement outranks colour.** A track two seeds both point at is about
both of them, and choosing a second seed is how the listener said so; colour
breaks the tie. A candidate is also measured only against the seeds that named
it, because a seed that never proposed it has no opinion about it.

**The tempo filter is blunt, and measurably blunter at slow tempos.** 25% around
the seeds' average, as specified. Measured, one seed each: `Karma Police` at 75
BPM dropped 22 of 30 candidates and returned 8; `Sicko Mode` at 155 dropped 6
and returned a full 20; `Blinding Lights` at 171 dropped 18 and returned 12.
Three seeds average out and behave — 26 of 57 dropped, 20 returned. The cause is
that a relative tolerance is a narrow absolute window at a low tempo (±19 BPM at
75, ±39 at 155) and octave ambiguity lands in the gap: at a slow seed, every
candidate ReccoBeats read at the doubled octave is 100% away and goes.

**Both obvious fixes are refused, and the second one is the trap.** Octave
normalisation is already a standing decision in the other direction. Widening
the tolerance would be a constant tuned to three seeds, which is the mistake the
neutral gate made. A single slow seed returning eight suggestions is the honest
cost of both refusals, not an oversight. If it is ever changed, change it
against a measured set and write the set down here.

Deezer was the original source for artwork and tempo and is **no longer in the
pipeline**. Its trap is worth remembering: it answered `bpm: 0` far more often
than it missed a track outright, so a match rate near 100% went with BPM
coverage under a third. Whatever the source, count matches and coverage
separately.

---

## Spotify visual rules

- **Nothing may be drawn on top of artwork**, and it may not be cropped,
  animated, distorted or blurred. The index, the hex and the colour ribbon sit
  *below* the cover; the reveal animates only the colour plate behind it; the
  hover affordance lives on the title, which is also the link out.
- **Corner radius 8px on desktop, 4px on mobile** (`--radius-artwork`). The rest
  of the interface keeps its own 12px — the rule is about artwork only.
- **Attribution**: the official white monochrome mark, once, above the grid, at
  96px wide (minimum is 70px) with 14px of clear space, which is half the
  rendered icon height. Green is sanctioned only on black or white, and green
  Spotify beside green Spettro would read as endorsement. Asset in
  `public/spotify/`, downloaded from the official Design Guidelines pack.
- **Every track links back to Spotify**, via `external_urls.spotify` on the
  title, labelled "Play on Spotify" in its accessible name.
- Allowed link labels are exactly: "OPEN SPOTIFY", "PLAY ON SPOTIFY", "LISTEN ON
  SPOTIFY", "GET SPOTIFY FREE".

---

## Contractual obligations

Spotify's Developer Terms v10 (15 May 2025) bind this app. Two clauses fire when
nobody will think to reread the contract:

**Security incidents — 24 hours.** If Spotify personal data held by this app is
lost, corrupted, or accessed by anyone who should not have it, notify
`security@spotify.com` without undue delay and **within 24 hours** (Appendix A,
point 9).

**No AI training on Spotify data — ever.** Section IV.2.a.i forbids using the
Spotify Platform or Spotify Content to train a machine learning or AI model or
to let it feed into one. Not limited to production: **do not paste playlist
contents, track metadata, cover art or API responses into an AI service while
developing or debugging either.** Reduce a bug to a synthetic example first.

**Retention (IV.3 audit, current and verified).** Nothing is cached. Every
outbound `fetch` sets `cache: 'no-store'`, all API routes are `force-dynamic`,
there is no module-level cache and no browser storage. Keep it that way. If a
cache ever becomes necessary for performance it may hold only metadata and
artwork, must be short-lived, and must not persist to disk.

**Logging.** Production logs carry counts only — no track titles, artists or
playlist ids, and unexpected failures log the error's type and not its message,
because a failed fetch quotes the URL it failed on. Detail goes through
`debug()` in `src/lib/server/log.ts`, silent outside development. The privacy
policy states this, so a change here is a change to a published promise.

`/privacy` and `/terms` describe the implementation exactly and are linked
beside the connect button so they are reachable before sign-in. The cookie
table, the list of what is read, and the named third parties are all statements
about code: change one and the other must follow.

**There are two third parties now, and they are not the same kind.** ReccoBeats
receives base-62 track ids — opaque strings that say nothing without Spotify's
catalogue to resolve them against. **Last.fm receives the title and artist of
the seeds, in words**, which is legible on its own and is a statement about
somebody's taste. The privacy policy says so in those terms rather than listing
a hostname and leaving it there. Last.fm is asked nothing at all in Order and is
never sent anything from a playlist. If a change ever sends it more than the
seeds, that page changes with it.

---

## `npm audit` on the image decoder: do not "fix" it

`npm audit` reports four moderate vulnerabilities. **They are one advisory**,
[GHSA-5v7r-6r5c-r473](https://github.com/advisories/GHSA-5v7r-6r5c-r473),
CVSS 5.3, counted once for `file-type` — where it actually lives — and three
more times for the packages that merely depend on it: `@jimp/core`,
`@jimp/custom` and `@vibrant/image-node`, which decodes the covers.

The bug is an infinite loop in the **ASF** parser on malformed input with a
zero-size sub-header. It is not reachable here. That branch is entered only
when the bytes open with the ASF GUID `30 26 B2 75 8E 66 CF 11 A6 D9`, and the
only bytes this app decodes are album artwork fetched from Spotify's CDN —
host-checked before the request and again on the URL the response came back
from (`src/lib/spotify-cdn.ts`). Reaching it would require Spotify to serve a
malformed ASF file where a cover should be.

**`npm audit fix` does not resolve it, and `--force` makes it much worse.**
The fix in `file-type` landed in 21.3.1, which is ESM-only, while
`@jimp/core@0.22.12` declares `^16.5.4` and loads it with `require()` — so
pinning it through `overrides` breaks jimp instead. What `--force` actually
does is *downgrade* `@vibrant/image-node` from 4.0.4 to 3.0.0, which pulls in
`jimp@0.2.28` from 2017 along with `request` and `form-data`. Measured, in an
isolated install: **4 moderate become 11 vulnerabilities, 5 of them critical**
and 2 high — SSRF in `request`, CRLF injection and an unsafe boundary in
`form-data`, prototype pollution in `minimist` and `tough-cookie`, and an
infinite loop in `jpeg-js`, which is the same class of bug in the decoder for
the format the covers actually are. From there `npm audit` recommends
reinstalling 4.0.4: the advice is circular.

The downgrade would not change the output — 3.0.0 returns byte-identical
pixel data on six covers, so the colours and the sequence would survive it.
That is not the reason to refuse it; the eleven vulnerabilities are.

**The real way out is `@jimp` updating `file-type`, not anything done here.**
Until that lands, staying on `@vibrant/image-node@4.0.4` and leaving the audit
reporting four moderates is the correct position, not an oversight.
---

## Working conventions

- A dedicated branch per part; one commit per activity.
- **An annotated restore tag on `main` before starting a part**, named for
  what comes next (`pre-cdn-resilience`), so the state the work began from
  can be named without counting merge commits backwards. Push it with the
  branch it belongs to.
- **No merge to main without explicit confirmation.** Same for pushing.
- Commit messages explain the non-obvious *why*, not the diff.
- Visual verification with Playwright at **desktop 1280×900** and **mobile
  390×844** (the grid is 7 columns above the 761px breakpoint, 3 below).
- **Verify real behaviour, not just screenshots.** Read back the API response,
  assert on counts and ordering, compare two runs for determinism. Several
  conclusions in this project were wrong until measured.
- **`fullPage: true` screenshots are unreliable on the grid.** Chromium's
  capture-beyond-viewport does not paint images that were never composited on
  screen, so the lower rows come out as empty colour plates while the DOM says
  every image is decoded. Set the viewport to the full page height and take an
  ordinary screenshot instead.
- OAuth cannot be driven headlessly from a cold profile. The scratchpad keeps a
  persistent Chromium profile (`chrome-profile`) whose Spotify session survives
  between runs; a fresh sign-in needs a headed window for the human to log in,
  after which the script can click the consent button itself.
- Band counts should be read **per distinct cover, not per track**. Eight tracks
  from one album inflate a band and look like a mis-tuned range; they are not.
- **`npx tsc --noEmit` can report success on code that does not compile.**
  `incremental` is on in `tsconfig.json`, and a stale `tsconfig.tsbuildinfo`
  makes it skip work it should redo — it passed a build with three genuine type
  errors in it. Delete `tsconfig.tsbuildinfo` before typechecking, or trust
  `npm run build`, which runs a full pass.
- **A test harness that runs no assertions must fail, not pass.** Two scripts
  here printed "ALL CHECKS PASSED" after checking nothing, because the API call
  they were built on had returned an error and the loop had no rows to walk.
  Count the assertions and assert on the count.
- **Click the mode tab, then wait for the panel to be visible.** A click that
  lands before hydration does nothing, and the failure surfaces many steps later
  as a field that exists but is hidden inside the other panel.
- **Stub the dependency when the question is about the client.** The picker's
  whole interaction — typing, picking by mouse and keyboard, replacing,
  abandoning an edit, clearing, the button at zero to three seeds — is client
  behaviour and was verified against a stubbed `/api/spotify/search` while
  Spotify was refusing. Say which leg that leaves unproven, and keep owing it.
  Both legs are now verified, a day apart, and they agreed.
- **A "no results" query must contain no real words.** `zzzqqxvv nothing at all`
  looks like nonsense and is not: Spotify matched it on *nothing* and *all* and
  returned tracks, so the empty state never ran and the check failed on a fact
  about English. `qxzvbnmwkj` works.
- **A script written before the seed picker will silently measure an empty
  page.** `bar.mjs` typed a title into the field and pressed Find, which used to
  set a seed and now sets nothing — Find stays disabled, no results appear, and
  it reads exactly like a broken product. Any script that predates the picker
  has to be taught to choose from the dropdown first.

Playlists used for verification so far, both owned by the account that signs in
(anything else is a 403):

- `6pE9NUVvRWxg427FpVMSow` — "mix 4 (ritmo)", ~45 tracks, rap-heavy. Lots of
  black-and-white artwork, so it exercises the achromatic bands and is the one
  the reds problem showed up on.
- `3bfHFW9vZBk9hvxqnzVJsz` — "bailar", 24 tracks, Latin. Colourful, no
  achromatic covers at all, and it contains eight tracks from one album — the
  case that makes a hue band look over-crowded when it is not.

Seeds used to verify Discover, each chosen for what it exercises:

- `Karma Police` — one seed, slow (75 BPM), the case where the tempo filter
  bites hardest and the list comes back at 8.
- `Karma Police` + `Paranoid Android` + `Everlong` — three seeds, a full 20 back,
  and the case that shows the ranking: two `seedMatches: 3` rows first, then the
  2s, then the 1s, each group sorted by colour distance. Two rows come back at
  distance exactly 0.0000 because they are other tracks from *OK Computer* and
  share the seed's cover.
- `Womb Sound Shusher` — resolves on Spotify, has no Last.fm neighbours at all,
  and has no tempo either, so it is the only known way to reach both the empty
  state and the branch where the tempo filter does not run.

Useful OKLCH anchors: red 29°, orange 53°, gold 95°, yellow 110°, green 142°,
turquoise 185°, cyan 195°, sky 226°, blue 264°, indigo 302°, purple 328°,
pink 352°. Indigo and blue-violet land within a degree of each other and part on
lightness, which is why that band border is a convention.

**Two band borders are conventions now, and for the same reason.** The
yellow/green split moved from 125° to 120° because a dark olive at 121° stayed
in yellow, where — being far darker than every other yellow — the sort inside
the band put it first, and it read on screen as a patch of green between two
runs of gold. The measurement that settled it: in one playlist the family
around that cover spanned 72° to 129°, so it was never one hue family cut in
half; the odd one out was dark, not differently coloured. `#576337` measures
121.4° at lightness 0.478 while `#EDE1AD`, three positions later, measures
96.6° at 0.907.

**The known limit, unfixed on purpose.** At one hue a light colour reads cream
and a dark one reads olive, and they belong to different families to the eye
while a boundary drawn on hue alone cannot tell them apart — exactly the
indigo/violet problem in another part of the wheel. Moving the border fixed
the case that turned up and does not fix the class: the next olive at 123°, or
a very dark yellow at 100°, will land the same way. A band border that reads
lightness as well as hue is the shape of a real fix and is deliberately not
built, because these ranges are tuned by eye and a rule fitted to one playlist
is how the neutral gate went wrong.

---

## The seed picker

Three comboboxes over `/v1/search`, one per slot. A seed is **chosen and never
typed**: the engine gets its title, artist and Spotify id together and fetches
by id, rather than searching a name a second time and risking a different
pressing with different artwork — and so a different colour to rank against.
The engine was written to accept that shape from the start and did not change.

The engine still accepts a bare title, and that path is not dead code: it is
what makes the API usable without the picker, and `meta.seedsResolved` is what
reports whether a guess worked.

Decisions in `SeedSlots.tsx` that are not defaults:

- **Enter never invents a seed.** It picks the highlighted row or does nothing.
  A string that was never resolved is exactly what this replaces.
- **Leaving a slot mid-edit restores the picked title**, on blur and on Escape.
  Otherwise the field shows one song while the app holds another, and Find sits
  enabled on a seed nothing on screen names.
- **The list is hidden with `display: none`, never unmounted**, because the
  `aria-controls` on the input would otherwise point at an element that is not
  in the document.
- **The state line under each field keeps its height** in all five of its
  states, since every one of them arrives while somebody is typing above it and
  a line that appeared and vanished would move the next slot on mobile.
- **`empty` and `failed` are different states.** Spotify having nothing means
  retype; Spotify not answering means retry. The picker got this wrong first
  time and said "No songs match that." to a 429.

The debounce is 300ms and the floor is two characters, which are quota
decisions before they are UX ones — see the rate-limit note above. The privacy
policy says the partial text reaches Spotify as you type, because it does.

**The dropdown overlays what is below it**, including the Find button and, on
mobile, the other two slots. That is deliberate: the alternative reflows the
column under the reader's hands while they are typing. It was looked at on both
viewports and left.

**Verified against the live search on 10 September 2026, 43 checks passing** at
1280x900 and 390x844: typing with and without results, thumbnails off the real
CDN, selection by mouse and by keyboard, replacing a chosen seed, abandoning an
edit, clearing, and the button at zero to three seeds. The focus ring was
measured rather than eyeballed — the frame goes `rgb(0,199,22)` to
`rgb(67,236,68)` and the outline is `solid 2px rgb(90,254,89)` on each of the
three fields in turn, with never more than one framed.

The live list is also the argument for the whole feature. Typing `karma police`
returns three entries called Karma Police — Radiohead's, Radiohead's remaster,
and a different song by Pierce The Veil — with visibly different sleeves.
Picking the wrong one ranks the entire search on the wrong colour, and only the
cover tells them apart at a glance.

**The result bar below the 80 BPM floor was verified the same day.** `My Hero`
at 77 BPM draws 4.3px; `Viva La Vida`, which has no tempo at all, draws no bar.
That is the distinction `MIN_BAR_SHARE` exists for, and it now has a screenshot
behind it rather than only arithmetic.

## What is left

- **Part D — accessibility.**
- ReccoBeats also offers seed-based recommendations; whether that replaces or
  joins Last.fm is still undecided, and since the pool is the only thing Last.fm
  is used for, swapping it is a change confined to `collectCandidates`.
- **The first Vercel deploy.** The code no longer assumes a host: the origin
  comes from `src/lib/server/base-url.ts`, which prefers `SPETTRO_BASE_URL`,
  falls back to `VERCEL_PROJECT_PRODUCTION_URL`, and otherwise uses
  `http://127.0.0.1:3000`. What is still manual: set `SPOTIFY_CLIENT_ID` in the
  project's environment variables, tick **Enable access to System Environment
  Variables** in the project settings (Vercel does not expose
  `VERCEL_PROJECT_PRODUCTION_URL` without it), and register the production
  callback on the Spotify app. Cookies become `Secure` on their own because
  `baseCookie` keys off `NODE_ENV`, and `allowedDevOrigins` is dev-only.

  **`VERCEL_URL` is the wrong variable and must not be used here.** It is
  unique to each deployment, and Spotify refuses any `redirect_uri` that is
  not registered on the app beforehand, so sign-in would break on every
  deploy. The consequence of using the production URL instead: a sign-in
  begun on a preview deployment comes back to production. Registering every
  preview URL by hand is the only alternative, and it is not possible in
  advance.

## The neutral gate, and five things that do not fix it

Open question left from Part A, now measured against a full eye-judged ground
truth. **Do not re-run these experiments; they are all negative results.**

**What the gate actually is.** `NEUTRAL_CHROMA` 0.045 marks a pixel as carrying
hue; `NEUTRAL_SHARE` 0.12 is a **quota over the whole image** — the share of
such pixels decides neutral against chromatic (`src/lib/server/cover.ts`). The
dominant cluster runs only *after* that gate and only picks the hue. Note also
that the clustering input is pre-filtered at `NEUTRAL_CHROMA`, so a cover whose
colour is real but sits entirely below 0.045 is invisible to the cluster no
matter what the gate does.

**Ground truth.** All 37 distinct covers of `6pE9NUVvRWxg427FpVMSow` judged by
eye: 16 must be neutral, 14 must be chromatic, 7 accept either. Cover numbers
below are positions in the distinct-cover list, in the order the ordered API
response returns them (so the neutral bands come first, covers 1-15).

**Current behaviour: gate 32/37, exact band 29/37. It errs in both directions.**
Covers 2 (dark brown) and 10 (azure) are called neutral and are not; covers 22,
24 and 29 are called orange, orange and blue and are really grey, white and
black. The earlier note that half of the neutral covers really are
monochrome photographs was right about the count and wrong about the direction
of the remaining error.

**Why no summary statistic fixes it.** Covers 6 and 7 read as grey to the eye
but measure *more* coloured than cover 2, which reads as brown: mean OKLab
chroma 0.0196 and 0.0213 against 0.0187. Every threshold on a whole-image
statistic therefore has to put 2 above 6 and 7, and none does. Measured and
rejected:

- **Dominant-cluster gate** (the obvious fix): best 14/15 on the neutral set,
  but the separating threshold sits in a band 0.0004 wide holding covers 2, 7, 6
  and 13, which the eye splits. That is fitting noise, and it also flips 4 of
  the 22 chromatic covers, two of them at cluster chroma 0.08-0.09.
- **Hue coherence** (|mean of a,b| over mean of |a,b|): 24/37. Cover 2 is indeed
  coherent at 0.961, but cover 10 is 0.375 — as low as covers the eye calls grey
  — while near-grey covers 1, 3, 13, 14 sit at 0.95-0.99 on a trace of tint.
- **Hue concentration** (largest share within a 45° sector): 15/15 on the
  neutral set, the only measure that gets them all, but it moves 14 of the 22
  chromatic covers into the neutral bands, one of them at mean chroma 0.0901.
  Overfitted to two positive examples.
- **Edge and corner sampling**, on the theory that the background carries the
  read: nine variants — border frames of 8, 12 and 16px, corner blocks of 12, 16
  and 20px, and three centre-weighted gradients — each swept over both
  thresholds. Best gate 35/37, best exact band 33/37, against 35/37 and 32/37
  for the whole image. No region beats sampling everything, so the failing
  covers are not a matter of where the pixels are read.
- **Chroma percentiles, chroma relative to lightness, mid-lightness-only chroma,
  clustering restricted to the a,b plane**: all 33-35/37, all failing on 6 and
  7.

**Thresholds left as they are, and the retune is dead.** The same quota rule at
`NEUTRAL_CHROMA` 0.0375 and `NEUTRAL_SHARE` 0.31 measures better on this
playlist — gate 35/37, exact band 32/37, fixing 22, 24 and 29 and still missing
2 and 10 — so it was validated against `3bfHFW9vZBk9hvxqnzVJsz`, which has no
achromatic covers at all. It invents four: 4 of that playlist's 14 distinct
covers cross into black, grey and white, on chromatic-pixel quotas of 22-29%
sitting just under the 31% bar. Raising the quota is fitted to the monochrome
artwork of the rap playlist and does not survive contact with a colourful one.
Keep 0.045 and 0.12.

The useful shape of the problem, for whoever picks this up: the gate needs a
measure of whether a cover has *a colour*, and every candidate here is a measure
of *how much chroma* it contains. Those come apart on exactly the covers that
fail. A different kind of evidence would be needed — not another threshold.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
