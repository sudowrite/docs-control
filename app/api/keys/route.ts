/**
 * API Key management — create, list, revoke keys.
 * Requires authenticated session (not agent keys — you manage keys from the dashboard).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createApiKey, listApiKeys, revokeApiKey } from '@/lib/api-keys';

async function requireSession() {
  const session = await auth();
  if (!session?.user?.email) {
    // Allow dev bypass
    const isDev = process.env.NODE_ENV === 'development';
    const oauthConfigured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
    if (isDev && !oauthConfigured) return 'dev@sudowrite.com';
    return null;
  }
  return session.user.email;
}

export async function GET() {
  const user = await requireSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const keys = await listApiKeys();
  return NextResponse.json({ success: true, keys });
}

export async function POST(req: NextRequest) {
  const user = await requireSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const { rawKey, meta } = await createApiKey(name);

  return NextResponse.json({
    success: true,
    key: rawKey, // Only returned once!
    meta,
  });
}

export async function DELETE(req: NextRequest) {
  const user = await requireSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Key ID required' }, { status: 400 });
  }

  const revoked = await revokeApiKey(id);
  if (!revoked) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
