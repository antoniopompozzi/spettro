import { spotifyPlaylistId } from '@/lib/playlist';
import { OrderError } from '@/lib/server/errors';
import { sequenceTracks } from '@/lib/server/sequence';
import { fetchPlaylistTracks } from '@/lib/server/spotify';

// Cover decoding uses Node APIs, and the token cache wants a process that
// outlives one request.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
    const url = typeof body?.url === 'string' ? body.url : '';
    const playlistId = spotifyPlaylistId(url);
    if (!playlistId) {
      throw new OrderError(
        400,
        'That link is not a Spotify playlist. Paste a link that begins with open.spotify.com/playlist.',
      );
    }

    const found = await fetchPlaylistTracks(playlistId);
    if (found.length === 0) {
      throw new OrderError(422, 'That playlist is empty — there is nothing to sequence.');
    }

    const payload = await sequenceTracks(found);
    if (payload.tracks.length === 0) {
      throw new OrderError(
        422,
        'None of the covers in that playlist could be read. Try another playlist.',
      );
    }

    console.info(`[order] ${playlistId}:`, payload.meta);
    return Response.json(payload);
  } catch (error) {
    if (error instanceof OrderError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('[order] unexpected failure', error);
    return Response.json(
      { error: 'Something went wrong while reading that playlist. Try again.' },
      { status: 500 },
    );
  }
}
