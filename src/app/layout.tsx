import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Mono, Zen_Dots } from 'next/font/google';

import { FilmGrain } from '@/components/FilmGrain';

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

export const metadata: Metadata = {
  title: 'Spettro',
  description:
    'Reorder one of your playlists so its covers move through the colour spectrum, and find new tracks from up to three seeds.',
  applicationName: 'Spettro',
  manifest: '/manifest.webmanifest',
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
