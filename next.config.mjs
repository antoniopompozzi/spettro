/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Spotify only accepts a numeric loopback redirect URI, so the app is opened
  // at 127.0.0.1 in development and the dev server has to recognise that host.
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
