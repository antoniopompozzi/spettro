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
    <LegalPage title="Privacy policy" updated="8 September 2026">
      <div className={styles.lede}>
        <p>
          <strong>The short version.</strong> Spettro has no database. It never reads your
          Spotify profile — not your name, your email, your photo or your listening history.
          Nothing you do here is written to a server. Disconnecting deletes your session
          straight away, and there is nothing else left to erase.
        </p>
      </div>

      <p>
        Spettro reorders one of your Spotify playlists so its cover art moves through the
        colour spectrum. To do that it has to read the playlist you point it at. This page
        says exactly what it reads, who else sees it, and how long anything lasts. Collecting
        and using your information is subject to this policy, and to nothing else.
      </p>

      <h2>What Spettro reads</h2>
      <p>
        When you connect, Spettro asks Spotify for two permissions and no others:{' '}
        <code>playlist-read-private</code>, to read playlists you own, and{' '}
        <code>playlist-read-collaborative</code>, to read playlists you collaborate on. It
        does not ask for access to your profile, your email address, your library, your
        followers or what you listen to.
      </p>
      <p>Then, for each track in the playlist you paste, it reads:</p>
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

      <h2>How it is used</h2>
      <p>
        Only to build the sequence you asked for, and only for as long as that takes. Titles
        and artists label the covers; each cover image is reduced to the colour that decides
        where a track sits; the tempo and the explicit flag fill in the read-out and the
        badge; the link is what the title points at. The playlist exists in your browser
        while the page is open, and in the server&rsquo;s memory for the length of one
        request. Reload the page and it is gone.
      </p>

      <h2>Who else sees it</h2>
      <p>Two services outside Spotify and your browser are involved, both narrowly:</p>
      <ul>
        <li>
          <strong>ReccoBeats</strong> (<code>api.reccobeats.com</code>) supplies tempo and
          audio features. Spettro sends it the Spotify track identifiers of the tracks in
          your playlist and nothing else — no session token, no cookie, no account
          identifier, nothing that names or identifies you. It does see which tracks were
          looked up.
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
        One thing worth naming plainly: when a cover cannot be read or a tempo is missing,
        Spettro writes a diagnostic line to its own server log naming that track, and it logs
        the playlist identifier with a count of what was sequenced. Those lines are not
        collected, indexed or kept anywhere by Spettro.
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
        Spotify and to ReccoBeats is made with caching switched off, so nothing survives
        between one sequence and the next. Your browser caches the cover images the way it
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
