/**
 * Security headers live in two places, for one reason.
 *
 * Everything with a fixed value is here, applied to every response including
 * the API routes. The Content-Security-Policy is not: it carries a nonce that
 * has to be new on every request, so it is built in `proxy.ts`, which is the
 * only place that runs per request. Setting a fixed CSP here as well would
 * shadow that one.
 */
const isProduction = process.env.NODE_ENV === 'production';

const securityHeaders = [
  // Clickjacking. `frame-ancestors 'none'` in the CSP says the same thing to
  // modern browsers; this is kept for the ones that only know the old header.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Same-origin requests keep the full URL, cross-origin ones send the origin
  // only — so a playlist id never travels in a Referer to another site.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Spettro asks for none of these. Denying them means an embedded frame
  // cannot ask on our behalf either.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
];

if (isProduction) {
  // Two years with subdomains, the value preload lists ask for. Production
  // only: sending it over the plain-http dev server would pin 127.0.0.1 to
  // https in the browser and lock the developer out of their own machine.
  securityHeaders.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The framework's own advertisement, and a free hint about what to attack.
  poweredByHeader: false,
  // Spotify only accepts a numeric loopback redirect URI, so the app is opened
  // at 127.0.0.1 in development and the dev server has to recognise that host.
  allowedDevOrigins: ['127.0.0.1'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
