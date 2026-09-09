import type { Metadata } from 'next';

import { LegalPage, legalStyles as styles } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy policy — Spettro',
  description: 'What Spettro reads from your Spotify account, where it goes, and what is kept.',
};

const CONTACT = 'emoproject230@gmail.com';
const SPOTIFY_APPS = 'https://www.spotify.com/account/apps/';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="9 September 2026">
      <div className={styles.lede}>
        <p>
          <strong>The short version.</strong> Spettro has no database. It never reads your
          Spotify profile — not your name, your email, your photo or your listening history.
          Nothing you do here is written to a server. Disconnecting deletes your session
          straight away, and there is nothing else left to erase.
        </p>
      </div>

      <p>
        Spettro does two things. <strong>Order</strong> reorders one of your Spotify playlists
        so its cover art moves through the colour spectrum, which means reading the playlist
        you point it at. <strong>Discover</strong> takes up to three song titles you type and
        suggests tracks whose cover art is close to theirs in colour, which means looking those
        songs up and looking up the tracks it might suggest. This page says exactly what each
        one reads, who else sees it, and how long anything lasts. Collecting and using your
        information is subject to this policy, and to nothing else.
      </p>

      <h2>What Spettro reads</h2>
      <p>
        When you connect, Spettro asks Spotify for two permissions and no others:{' '}
        <code>playlist-read-private</code>, to read playlists you own, and{' '}
        <code>playlist-read-collaborative</code>, to read playlists you collaborate on. It
        does not ask for access to your profile, your email address, your library, your
        followers or what you listen to.
      </p>
      <p>
        In <strong>Order</strong>, for each track in the playlist you paste, it reads:
      </p>
      <ul>
        <li>the track title and the name of the main artist;</li>
        <li>the Spotify track identifier;</li>
        <li>whether the track is marked explicit;</li>
        <li>the album cover image;</li>
        <li>the link to the track on Spotify.</li>
      </ul>
      <p>
        It also reads the playlist identifier out of the link you paste. It does not read the
        playlist&rsquo;s name, its description or its cover image.
      </p>
      <p>
        In <strong>Discover</strong>, it reads what you type into the seed fields.{' '}
        <strong>As you type, the text is sent to Spotify to search for it</strong> — not only
        the finished title, but the partial one, each time you pause. Spettro waits for a
        pause rather than sending every keystroke, and asks nothing at all until you have
        typed two characters, but what reaches Spotify is a search box you are still typing
        into. Once you pick a song from the results, it looks up the tracks it is considering
        suggesting, and for each of those reads the same five things listed above. None of
        this touches your playlists, your library or your listening history — Discover
        searches the public catalogue, and the only thing it knows about you is what you
        typed and what you picked.
      </p>

      <h2>How it is used</h2>
      <p>
        Only to build the sequence you asked for, and only for as long as that takes. Titles
        and artists label the covers; each cover image is reduced to the colour that decides
        where a track sits; the tempo and the explicit flag fill in the read-out and the
        badge; the link is what the title points at. In Discover the same cover colours decide
        which tracks are close enough to suggest, and the tempo only removes suggestions whose
        speed is nowhere near your seeds&rsquo;. The playlist, or the list of suggestions,
        exists in your browser while the page is open, and in the server&rsquo;s memory for the
        length of one request. Reload the page and it is gone.
      </p>

      <h2>Who else sees it</h2>
      <p>Three services outside Spotify and your browser are involved, each narrowly:</p>
      <ul>
        <li>
          <strong>ReccoBeats</strong> (<code>api.reccobeats.com</code>) supplies tempo and
          audio features. Spettro sends it the Spotify track identifiers of the tracks in
          your playlist and nothing else — no session token, no cookie, no account
          identifier, nothing that names or identifies you. It does see which tracks were
          looked up.
        </li>
        <li>
          <strong>Last.fm</strong> (<code>ws.audioscrobbler.com</code>) is asked, in Discover
          only, which tracks are commonly listened to alongside a given one. This is the one
          place where something you chose leaves as words rather than as an identifier:
          Spettro sends it <strong>the title and artist of the songs you seed with</strong>,
          and nothing else — no session token, no cookie, no account identifier, nothing that
          names or identifies you, and never anything from a playlist. It is not asked
          anything in Order, and its answer is used only to decide which tracks are worth
          looking up; Spettro then ranks them on colour by itself.
        </li>
        <li>
          <strong>Spotify&rsquo;s image servers</strong> (<code>i.scdn.co</code>) hold the
          cover art. Spettro&rsquo;s server fetches each cover to read its colour, and your
          browser fetches them again to display them.
        </li>
      </ul>
      <p>
        That is the complete list. Your information is <strong>never sold, rented or
        transferred</strong> to advertising networks, advertising exchanges, data brokers or
        anything of that kind. There is no analytics, no advertising and no tracking here.
      </p>
      <p>
        <strong>Nothing about your music reaches the server log.</strong> Spettro records
        counts — how many tracks were sequenced, how many covers could not be read, how many
        suggestions survived each stage — and never a track title, an artist, the identifier of
        the playlist you gave it, or the songs you searched from. When
        something fails unexpectedly it logs the kind of failure and not its details, because
        the details would quote the address it failed on and those addresses carry
        identifiers. The detailed diagnostics exist only when Spettro is run on a
        developer&rsquo;s own machine.
      </p>

      <h2>Cookies</h2>
      <p>
        Four, all of them strictly necessary to sign you in and keep you signed in. Every one
        is <code>HttpOnly</code>, so no script on the page can read it, host-only, and{' '}
        <code>SameSite=Lax</code>. None of them track you, here or anywhere else.
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Cookie</th>
            <th>What it does</th>
            <th>How long</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>spettro_access_token</code>
            </td>
            <td>Keeps you signed in to Spotify</td>
            <td>About 59 minutes</td>
          </tr>
          <tr>
            <td>
              <code>spettro_refresh_token</code>
            </td>
            <td>Renews the above without asking you to sign in again</td>
            <td>30 days</td>
          </tr>
          <tr>
            <td>
              <code>spettro_pkce_verifier</code>
            </td>
            <td>Proves a sign-in was started by this browser</td>
            <td>10 minutes, deleted the moment sign-in finishes</td>
          </tr>
          <tr>
            <td>
              <code>spettro_oauth_state</code>
            </td>
            <td>Protects against a forged sign-in</td>
            <td>10 minutes, deleted the moment sign-in finishes</td>
          </tr>
        </tbody>
      </table>

      <h3>Cookies from other companies</h3>
      <p>
        <strong>None.</strong> Spettro does not let any third party set a cookie here or track
        your browsing across other sites. There are no advertising cookies and no analytics
        cookies, from anyone.
      </p>

      <h3>Your options</h3>
      <ul>
        <li>
          <strong>Disconnect from Spotify</strong> on the main page deletes the session
          cookies immediately.
        </li>
        <li>
          Block or clear cookies in your browser settings. Blocking them means signing in
          cannot work, but the rest of the page still loads.
        </li>
        <li>
          Withdraw Spettro&rsquo;s access from your own Spotify account at{' '}
          <a href={SPOTIFY_APPS} target="_blank" rel="noreferrer">
            spotify.com/account/apps
          </a>
          .
        </li>
      </ul>

      <h2>How long anything is kept</h2>
      <p>
        The cookies last as long as the table says. Everything else is kept for the length of
        a single request and then discarded. There is no database, no stored copy of your
        playlists and no cache of Spotify content on disk: every request Spettro makes to
        Spotify, to ReccoBeats and to Last.fm is made with caching switched off, so nothing
        survives between one sequence and the next. Your browser caches the cover images the way it
        caches any image, and you can clear that with your browser.
      </p>
      <p>
        Because nothing is stored in the first place, deleting your data is instant rather
        than something that takes days.
      </p>

      <h2>Disconnecting your account</h2>
      <p>
        <strong>Disconnect from Spotify</strong> sits next to the connection indicator on the
        main page whenever you are signed in. Pressing it deletes both session cookies at
        once, and Spettro immediately loses its ability to reach anything in your account.
        You can also remove its access from{' '}
        <a href={SPOTIFY_APPS} target="_blank" rel="noreferrer">
          your Spotify account settings
        </a>
        , which revokes it from Spotify&rsquo;s side as well.
      </p>

      <div className={styles.contact}>
        <h2>Questions about your data</h2>
        <p>
          Write to <a href={`mailto:${CONTACT}`}>{CONTACT}</a> and ask. That address reaches
          the person responsible for Spettro.
        </p>
      </div>
    </LegalPage>
  );
}
