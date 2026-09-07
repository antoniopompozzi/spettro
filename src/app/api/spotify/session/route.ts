import { isConnected, signOut } from '@/lib/server/spotify-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ connected: await isConnected() });
}

export async function DELETE() {
  await signOut();
  return Response.json({ connected: false });
}
