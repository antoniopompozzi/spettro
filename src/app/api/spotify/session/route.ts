import { isConnected, signOut } from '@/lib/server/spotify-auth';
import {
  READ_LIMIT,
  RateLimited,
  enforceRateLimit,
  rateLimitedResponse,
} from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Whether an account is connected. Read by the page, so the ceiling is high. */
export async function GET(request: Request) {
  try {
    enforceRateLimit(request, 'session-read', READ_LIMIT);
  } catch (error) {
    if (error instanceof RateLimited) return rateLimitedResponse(error);
    throw error;
  }
  return Response.json({ connected: await isConnected() });
}

/** Disconnects. DELETE, not GET: it changes state and must not be navigable. */
export async function DELETE(request: Request) {
  try {
    enforceRateLimit(request, 'session-write', READ_LIMIT);
  } catch (error) {
    if (error instanceof RateLimited) return rateLimitedResponse(error);
    throw error;
  }
  await signOut();
  return Response.json({ connected: false });
}
