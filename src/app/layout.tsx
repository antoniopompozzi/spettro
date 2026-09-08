import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Mono, Zen_Dots } from 'next/font/google';

import { FilmGrain } from '@/components/FilmGrain';
import { baseUrl } from '@/lib/server/base-url';

import './globals.css';

/**
 * Every page renders per request, because the CSP in `proxy.ts` carries a
 * nonce and Next can only stamp one onto scripts it emits while answering a
 * real request. A prerendered page would ship script tags with no nonce, and
 * `strict-dynamic` would then block them: the build would look clean and the
 * production site would load nothing. Nothing here is cached anyway.
 */
export const dynamic = 'force-dynamic';

const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-sans',
  display: 'swap',
});

const zenDots = Zen_Dots({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

const DESCRIPTION =
  'Reorder one of your Spotify playlists so its album covers run through the colour spectrum. Spettro reads the artwork, never changes your playlist.';

export const metadata: Metadata = {
  // Every relative URL below — and the generated preview card — is resolved
  // against this, so it has to be the origin the app is actually served from
  // rather than a domain written down once and forgotten.
  metadataBase: baseUrl(),
  title: 'Spettro',
  description: DESCRIPTION,
  applicationName: 'Spettro',
  manifest: '/manifest.webmanifest',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Spettro',
    title: 'Spettro',
    // WhatsApp and the like show this under the image, so it says what the app
    // does and what it does not do — the read-only part is the reassurance
    // somebody wants before connecting an account.
    description: DESCRIPTION,
    url: '/',
    locale: 'en',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Spettro',
    description: DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    title: 'Spettro',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#141414',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${zenDots.variable} ${plexMono.variable}`}>
      <body>
        <FilmGrain />
        {children}
      </body>
    </html>
  );
}
