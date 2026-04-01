/**
 * Agent audit endpoint — same as /api/audit but authenticated via Bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer swdc_...' }, { status: 401 });
  }

  // Delegate to the main audit handler
  const { POST: auditHandler } = await import('@/app/api/audit/route');
  return auditHandler(req);
}
