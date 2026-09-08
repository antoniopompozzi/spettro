import 'server-only';

/**
 * Where this Spettro is running, as an absolute origin.
 *
 * Four things need it and must all agree: the `redirect_uri` sent to Spotify
 * when the flow starts, the identical one sent again when the code is
 * exchanged, `metadataBase` for the social preview, and the absolute URLs in
 * the sitemap. Deriving them from one place is what keeps them from drifting.
 *
 * The order below is deliberate.
 *
 * `SPETTRO_BASE_URL` wins when it is set, because a custom domain is a
 * decision nobody can infer from the environment.
 *
 * `VERCEL_PROJECT_PRODUCTION_URL` is the automatic fallback, and it is the
 * right one of Vercel's two URL variables. `VERCEL_URL` is unique to each
 * deployment, and Spotify only accepts a `redirect_uri` that matches a URI
 * registered on the app beforehand — so building the callback from it would
 * break sign-in on every deploy, one new URL at a time. This one holds the
 * project's shortest production domain (the custom one if there is one), is
 * stable across deploys, and Vercel sets it even on previews. It carries no
 * scheme, hence the `https://`.
 *
 * Nothing set at all means a developer's machine, where the loopback address
 * is not a preference: Spotify accepts only HTTPS or numeric loopback as a
 * redirect target, and the session cookies are scoped to the host the callback
 * landed on, so `localhost` and `127.0.0.1` are not interchangeable.
 *
 * Note for previews: because the fallback names the *production* domain, a
 * sign-in started from a preview deployment comes back to production. The
 * alternative is registering every preview URL with Spotify by hand, which is
 * not possible in advance.
 */
const DEVELOPMENT_ORIGIN = 'http://127.0.0.1:3000';

export function baseUrl(): URL {
  const explicit = process.env.SPETTRO_BASE_URL;
  if (explicit) return new URL(explicit);

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return new URL(`https://${production}`);

  return new URL(DEVELOPMENT_ORIGIN);
}

/** An absolute URL for a path in this app. */
export function absoluteUrl(path: string): string {
  return new URL(path, baseUrl()).toString();
}
