import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * The Content-Security-Policy, built per request because it carries a nonce.
 *
 * `proxy.ts` is this file's required name: the `middleware` convention was
 * deprecated in Next 16 and renamed, and a file called `middleware.ts` would
 * simply never run. Every other security header is a constant and lives in
 * `next.config.mjs`.
 *
 * Two directives are deliberately not what a template would say:
 *
 * `style-src` allows `'unsafe-inline'` and carries no nonce. The whole point of
 * the grid is a colour read off each cover, which React writes as a `style`
 * attribute on the plate and the ribbon — and a CSP nonce does not apply to
 * style *attributes*, only to `<style>` elements. A nonce here would leave the
 * grid rendering every cover on a transparent plate. Scripts keep the strict
 * policy, which is where the risk actually is: this allows a colour, not code.
 *
 * `connect-src` is `'self'` and nothing else. Spotify and ReccoBeats are called
 * from the API routes, on the server, where CSP does not reach — the browser
 * only ever talks to `/api/*`. Listing their domains here would be a comment
 * pretending to be a control.
 */
function policy(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    // `strict-dynamic` lets the nonced bootstrap load the rest of the bundle,
    // so the chunk URLs need no allowlist of their own. React needs `eval` in
    // development to rebuild server stacks in the browser; production does not.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    // Album art comes from Spotify's CDN and from nowhere else, which is the
    // same rule the server applies before it decodes an image.
    "img-src 'self' data: blob: https://*.scdn.co",
    // next/font self-hosts the files at build time, so no Google origin here.
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Production only: on the plain-http dev origin this would upgrade the
    // dev server's own requests to https and nothing would load.
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const value = policy(nonce, process.env.NODE_ENV === 'development');

  // Next reads the nonce back out of the request's own CSP header and applies
  // it to the scripts it emits, so both copies have to be set.
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', value);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', value);
  return response;
}

export const config = {
  matcher: [
    {
      // API routes answer JSON and serve no scripts, so a nonce buys them
      // nothing; static assets are immutable and prefetches render no page.
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
