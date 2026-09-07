import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

import { OrderError } from './errors';

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const TIMEOUT_MS = 10_000;
/** Renew a little before the hour is up so a request never races the expiry. */
const EXPIRY_MARGIN_S = 60;

/**
 * Reading a playlist's items needs `playlist-read-private` even for a public
 * playlist; the collaborative scope covers playlists shared with the listener,
 * and the profile scope is only there to name the connected account.
 */
const SCOPES = 'playlist-read-private playlist-read-collaborative user-read-private';

/**
 * Spotify only accepts HTTPS or the numeric loopback address, so the default is
 * `127.0.0.1` rather than `localhost` — and the app has to be opened there too.
 */
const DEFAULT_REDIRECT_URI = 'http://127.0.0.1:3000/api/spotify/callback';

const VERIFIER = 'spettro_pkce_verifier';
const STATE = 'spettro_oauth_state';
const REFRESH = 'spettro_refresh_token';
const ACCESS = 'spettro_access_token';

const base64url = (input: Buffer) => input.toString('base64url');

export function redirectUri(): string {
  return process.env.SPOTIFY_REDIRECT_URI ?? DEFAULT_REDIRECT_URI;
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
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
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
  jar.set(VERIFIER, verifier, { ...baseCookie, maxAge: 600 });
  jar.set(STATE, state, { ...baseCookie, maxAge: 600 });

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
    throw new OrderError(
      502,
      `Spotify refused the sign-in: ${detail?.error_description ?? detail?.error ?? response.status}`,
    );
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

/** Finishes the flow: checks the state nonce, trades the code for tokens. */
export async function completeSignIn(code: string, state: string): Promise<void> {
  const jar = await cookies();
  const expected = jar.get(STATE)?.value;
  const verifier = jar.get(VERIFIER)?.value;
  jar.delete(STATE);
  jar.delete(VERIFIER);

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
    throw new OrderError(401, 'Connect your Spotify account to read your playlists.');
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
