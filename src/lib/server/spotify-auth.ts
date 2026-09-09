import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

import { absoluteUrl } from './base-url';
import { OrderError } from './errors';
import { debug } from './log';

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const TIMEOUT_MS = 10_000;
/** Renew a little before the hour is up so a request never races the expiry. */
const EXPIRY_MARGIN_S = 60;

/**
 * Reading a playlist's items needs `playlist-read-private` even for a public
 * playlist, and the collaborative scope covers playlists shared with the
 * listener. Nothing else is asked for: Spettro never reads the profile, so
 * requesting `user-read-private` would be permission it does not use — and the
 * privacy policy would have to disclose a collection that never happens.
 */
const SCOPES = 'playlist-read-private playlist-read-collaborative';

/** The path Spotify sends the listener back to; the host comes from the environment. */
const CALLBACK_PATH = '/api/spotify/callback';

const VERIFIER = 'spettro_pkce_verifier';
const STATE = 'spettro_oauth_state';
const REFRESH = 'spettro_refresh_token';
const ACCESS = 'spettro_access_token';

const base64url = (input: Buffer) => input.toString('base64url');

/**
 * Spotify checks this against the URIs registered on the app, and checks it
 * twice: once when the flow starts and once when the code is exchanged. Both
 * calls read it from here, so the two can never disagree.
 */
export function redirectUri(): string {
  return absoluteUrl(CALLBACK_PATH);
}

function clientId(): string {
  const id = process.env.SPOTIFY_CLIENT_ID;
  if (!id) {
    throw new OrderError(
      500,
      'This Spettro is missing SPOTIFY_CLIENT_ID. Set it and restart the server.',
    );
  }
  return id;
}

/** Cookies are host-only and http-only: nothing here is readable from the page. */
const baseCookie = {
  httpOnly: true,
  // `lax` and not `strict`: the return from Spotify is a cross-site navigation,
  // and a strict cookie would not be sent with it, so the callback would find
  // neither the state nonce nor the verifier and every sign-in would fail.
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
} as const;

/**
 * The two flow cookies are scoped to the one route that reads them and live
 * five minutes, which is longer than a consent screen takes and shorter than a
 * walk away from the desk. They are deleted on the way out of the callback
 * whatever happened there.
 */
const oauthCookie = {
  ...baseCookie,
  path: '/api/spotify/callback',
  maxAge: 300,
} as const;

/**
 * Starts the flow: mints a PKCE verifier and a state nonce, parks both in
 * short-lived cookies, and returns the URL to send the listener to.
 */
export async function authorizeUrl(): Promise<string> {
  const verifier = base64url(randomBytes(64));
  const state = base64url(randomBytes(16));
  const challenge = base64url(createHash('sha256').update(verifier).digest());

  const jar = await cookies();
  jar.set(VERIFIER, verifier, oauthCookie);
  jar.set(STATE, state, oauthCookie);

  const params = new URLSearchParams({
    client_id: clientId(),
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: SCOPES,
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

async function exchange(body: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as
      | { error_description?: string; error?: string }
      | null;
    // Spotify's own wording goes to the developer, never to the listener: it
    // names grant types and parameters, and quoting an upstream error back into
    // the page is how internals end up on screen.
    debug('[spotify-auth] token endpoint refused', response.status, detail);
    throw new OrderError(502, 'Spotify refused the sign-in. Try connecting again.');
  }
  return (await response.json()) as TokenResponse;
}

async function store(tokens: TokenResponse): Promise<void> {
  const jar = await cookies();
  jar.set(ACCESS, tokens.access_token, {
    ...baseCookie,
    maxAge: Math.max(tokens.expires_in - EXPIRY_MARGIN_S, 0),
  });
  // Spotify rotates refresh tokens, so only overwrite when it hands out a new one.
  if (tokens.refresh_token) {
    jar.set(REFRESH, tokens.refresh_token, { ...baseCookie, maxAge: 60 * 60 * 24 * 30 });
  }
}

/**
 * Drops the two flow cookies. The callback calls this on every path out of
 * itself — consent refused, parameters missing, exchange failed, or success —
 * so a verifier never outlives the one attempt it was minted for.
 *
 * Deleting needs the same path the cookie was written with, or the browser
 * keeps the original.
 */
export async function clearOAuthCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete({ name: STATE, path: oauthCookie.path });
  jar.delete({ name: VERIFIER, path: oauthCookie.path });
}

/** Finishes the flow: checks the state nonce, trades the code for tokens. */
export async function completeSignIn(code: string, state: string): Promise<void> {
  const jar = await cookies();
  const expected = jar.get(STATE)?.value;
  const verifier = jar.get(VERIFIER)?.value;
  await clearOAuthCookies();

  if (!expected || !verifier || state !== expected) {
    throw new OrderError(400, 'That sign-in did not come from Spettro. Try connecting again.');
  }

  await store(
    await exchange(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(),
        client_id: clientId(),
        code_verifier: verifier,
      }),
    ),
  );
}

/**
 * A usable access token for the connected listener, refreshing it when the old
 * one has run out. Throws a 401 when nobody has connected an account yet.
 */
export async function userAccessToken(): Promise<string> {
  const jar = await cookies();
  const access = jar.get(ACCESS)?.value;
  if (access) return access;

  const refresh = jar.get(REFRESH)?.value;
  if (!refresh) {
    // Both modes reach this: Order reads a playlist, Discover searches the
    // catalogue, and neither can be done with an app token.
    throw new OrderError(401, 'Connect your Spotify account — Spettro asks Spotify as you.');
  }

  const tokens = await exchange(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh,
      client_id: clientId(),
    }),
  );
  await store(tokens);
  return tokens.access_token;
}

export async function isConnected(): Promise<boolean> {
  const jar = await cookies();
  return Boolean(jar.get(ACCESS)?.value ?? jar.get(REFRESH)?.value);
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS);
  jar.delete(REFRESH);
}
