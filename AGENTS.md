# SPETTRO

## Running it

Open the dev server at **http://127.0.0.1:3000**, never `localhost:3000`. Spotify
only accepts a numeric loopback redirect URI, so the OAuth callback lands on
127.0.0.1 and the session cookies are scoped to that host — cookies do not cross
between the two names, so on localhost a successful login still reads as
"not connected". `allowedDevOrigins` in `next.config.mjs` is there for the same
reason: without it Next blocks the dev resources and the page never hydrates.

`http://127.0.0.1:3000/api/spotify/callback` must be registered as a Redirect URI
on the Spotify app, spelled exactly like that.

## Spotify

Order runs on a **user** token (Authorization Code + PKCE), not client
credentials: since the 2026 API migration `/playlists/{id}/tracks` is gone and
its replacement `/playlists/{id}/items` refuses app tokens. Spotify serves
playlist items only to the playlist's owner or a collaborator, whatever its
privacy setting says — a public playlist belonging to someone else is a 403.
That constraint is what the UI copy promises against, so keep them in step.

`SPOTIFY_CLIENT_ID` is the only credential the app needs. PKCE does not use a
client secret; do not reintroduce one.

## Artwork and tempo

Cover art comes from Spotify and nowhere else, for two reasons that each settle
it alone. Spotify's design guidelines allow only Spotify-supplied artwork
alongside Spotify metadata. And a text search against another catalogue returns
whichever release ranks highest today — Deezer offered four different covers
among the first six hits for one track — so the extracted colour, and therefore
the whole sequence, would drift over time for reasons unrelated to the music.

Tempo comes from ReccoBeats (`/v1/audio-features?ids=…`, no auth, Spotify base-62
ids straight in, 40 ids per call, 500ms pacing) and from no second source. Tempo
estimation is ambiguous by an octave — 85 and 170 can describe the same groove —
so mixing sources puts tracks on different scales. One source keeps that error
systematic and relative comparisons intact. Do not normalise octaves either: a
drum and bass track at 170 and a hip hop track at 85 are genuinely different.

Roughly 10-25% of a playlist has no tempo from anyone. That absence is `null`,
never `0`, and never a reason to drop a track: it stays in the sequence and sits
out rhythmic comparison. The tempo read-out shows how many tracks it speaks for.

Deezer was the original source for both and is no longer in the pipeline. Its
trap is worth remembering though: it answered `bpm: 0` far more often than it
missed a track outright, so a match rate near 100% went with BPM coverage under
a third. Whatever the source, count the two separately.

## Legal obligations that do not live in code

Spotify's Developer Terms v10 (15 May 2025) bind this app because the developer
account accepted them. Two clauses fire at moments when nobody will think to go
and reread the contract, so they are written down here instead.

**Security incidents — 24 hours.** If Spotify personal data held by this app is
lost, corrupted, or accessed by anyone who should not have it, notify
`security@spotify.com` without undue delay and in any case **within 24 hours**
(Appendix A, point 9). In practice the only Spotify personal data this app holds
is the session tokens in a listener's own cookies, but a leaked client id, a
compromised host, or a bug that exposes another listener's session all count.

**No AI training on Spotify data — ever.** Section IV.2.a.i forbids using the
Spotify Platform or Spotify Content to train a machine learning or AI model, or
letting it feed into one. This is not limited to production: do not paste
playlist contents, track metadata, cover art or API responses into an AI service
while developing or debugging either. Reduce a bug to a synthetic example first.

Related, and already load-bearing elsewhere in this file: artwork may only come
from Spotify, and the app must not build a store of Spotify content. Section
IV.3 forbids retaining, aggregating or building databases of it beyond what a
request needs, and requires showing current data rather than stale copies. The
current implementation keeps nothing: every outbound request sets
`cache: 'no-store'`, all four routes are `force-dynamic`, there is no
module-level cache and no browser storage. Keep it that way — if a cache is ever
needed for performance, it may hold only metadata and artwork, must be
short-lived, and must not persist to disk.

**Privacy policy and end user agreement** live at `/privacy` and `/terms`, are
linked next to the connect button so they are reachable before sign-in, and
describe the implementation exactly. Change one and the other has to follow: the
cookie table, the list of what is read, and the named third party (ReccoBeats,
which receives Spotify track ids and nothing else) are all statements about code.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
