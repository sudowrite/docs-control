/**
 * Agent sync endpoint — same as /api/sync but authenticated via Bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer swdc_...' }, { status: 401 });
  }

  // Delegate to the main sync handler by calling it internally
  const { POST: syncHandler } = await import('@/app/api/sync/route');
  return syncHandler();
}
