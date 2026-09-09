import type { Metadata } from 'next';

import { LegalPage, legalStyles as styles } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Terms — Spettro',
  description: 'The agreement between you and Spettro when you connect a Spotify account.',
};

const CONTACT = 'emoproject230@gmail.com';

export default function TermsPage() {
  return (
    <LegalPage title="End user agreement" updated="9 September 2026">
      <div className={styles.lede}>
        <p>
          <strong>The short version.</strong> Spettro is an independent project that reads
          your Spotify playlists to reorder them by colour, and searches Spotify&rsquo;s
          catalogue to suggest tracks whose cover art is close to yours. It is not made by
          Spotify and speaks for nobody but itself. Connecting your account means you accept the terms
          below and the{' '}
          <a href="/privacy">privacy policy</a>.
        </p>
      </div>

      <h2>1. Spettro does not speak for Spotify</h2>
      <p>
        Spettro makes no warranty or representation on Spotify&rsquo;s behalf, and nothing
        here creates any obligation for Spotify. The Spotify Platform, the Spotify Service
        and the Spotify Content reach you <strong>as they are</strong>, with no warranty of
        any kind from Spettro.
      </p>
      <p>
        To the fullest extent the law allows, that includes disclaiming the implied
        warranties of <strong>merchantability</strong>, <strong>fitness for a particular
        purpose</strong> and <strong>non-infringement</strong> in respect of the Spotify
        Platform, the Spotify Service and the Spotify Content. In plain terms: Spettro cannot
        promise that Spotify&rsquo;s service will work, will keep working, will suit what you
        want it for, or that its content is free of anyone else&rsquo;s claims.
      </p>

      <h2>2. No modifying or building on the Spotify Platform</h2>
      <p>
        You may not modify the Spotify Platform, the Spotify Service or the Spotify Content,
        and you may not create derivative works based on any of them.
      </p>

      <h2>3. No reverse engineering</h2>
      <p>
        You may not decompile, reverse-engineer, disassemble or otherwise reduce the Spotify
        Platform, the Spotify Service or the Spotify Content to source code or to any other
        human-perceivable form, in whole or in part. This applies to the fullest extent
        permitted by law — where your local law grants you a right that cannot be waived,
        that right stands.
      </p>

      <h2>4. Who is responsible for Spettro</h2>
      <p>
        The author of Spettro is solely responsible for this application: for what it does,
        for supporting it and for any claim you might have about it. Nobody else is —
        expressly including <strong>Spotify</strong>, which neither makes Spettro nor
        endorses it and carries no liability for it. If something here is wrong, the person
        to take it up with is reachable at{' '}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>

      <h2>5. Spotify may enforce this agreement</h2>
      <p>
        <strong>Spotify is a third-party beneficiary</strong> of this end user agreement and
        of the <a href="/privacy">privacy policy</a>, and is entitled to enforce both of them
        directly against you. Although Spotify is not a party to the agreement between you
        and Spettro, it may act on these terms in its own right.
      </p>

      <h2>Ending it</h2>
      <p>
        You can walk away at any time. <strong>Disconnect from Spotify</strong> on the main
        page ends your session immediately, and you can also withdraw Spettro&rsquo;s access
        from{' '}
        <a href="https://www.spotify.com/account/apps/" target="_blank" rel="noreferrer">
          your Spotify account settings
        </a>
        . What happens to your data when you do is set out in the{' '}
        <a href="/privacy">privacy policy</a>: nothing is stored, so nothing survives.
      </p>

      <div className={styles.contact}>
        <h2>Contact</h2>
        <p>
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
        </p>
      </div>
    </LegalPage>
  );
}
