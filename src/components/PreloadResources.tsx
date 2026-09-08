/**
 * Opens the connection to Spotify's image CDN before anything asks it for a
 * cover.
 *
 * Every cover comes from `i.scdn.co`, and the first one pays for the DNS
 * lookup and the TLS handshake before a byte of image arrives. The grid is the
 * whole product, so that cost lands where it is most visible; warming the
 * connection while the page is still rendering moves it off the critical path.
 *
 * Written as a plain `<link>` rather than `ReactDOM.preconnect`, which is what
 * the Next docs point to for resource hints: called from a client component
 * that method emitted nothing into the server-rendered HTML — verified by
 * reading the response — so the hint would only have been applied after
 * hydration, which is later than the first cover needs it. React hoists this
 * element into the head itself.
 *
 * No `crossOrigin`: the covers load through plain `<img src>` with no CORS
 * request, and a credentialled preconnect would warm a connection the images
 * cannot then use.
 *
 * This does nothing for `meta.dropped`. Those failures happen server-side,
 * inside the API route, where a browser hint does not reach.
 */
export function PreloadResources() {
  return <link rel="preconnect" href="https://i.scdn.co" />;
}
