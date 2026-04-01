/**
 * Proposals API — list, approve (apply), reject proposals.
 *
 * Approving a proposal applies the edit to both GitHub and Featurebase.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getProposals, updateProposalStatus } from '@/lib/proposals';
import { applyProposal } from '@/lib/apply-proposal';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const session = await auth();
  const isDev = process.env.NODE_ENV === 'development';
  const oauthConfigured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
  if (!session?.user && !(isDev && !oauthConfigured)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const proposals = await getProposals(status);
    return NextResponse.json({ success: true, proposals });
  } catch {
    return NextResponse.json({ success: true, proposals: [] });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const isDev = process.env.NODE_ENV === 'development';
  const oauthConfigured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
  if (!session?.user && !(isDev && !oauthConfigured)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, action, proposal: inlineProposal } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Provide { id, action: "approve"|"reject" }' }, { status: 400 });
    }

    if (action === 'reject') {
      // Just update status — no side effects
      try {
        await updateProposalStatus(id, 'rejected');
      } catch {
        // May fail on Vercel — that's fine, UI already tracks state
      }
      return NextResponse.json({ success: true, status: 'rejected' });
    }

    // Approve — apply the edit to GitHub + Featurebase
    // The proposal can come from storage or inline from the client
    let proposal = inlineProposal;
    if (!proposal && id) {
      try {
        const all = await getProposals();
        proposal = all.find((p) => p.id === id);
      } catch {
        // Storage may not be available on Vercel
      }
    }

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found. Send the proposal object as { proposal: {...} }' }, { status: 404 });
    }

    const result = await applyProposal(proposal);

    // Update status in storage
    try {
      await updateProposalStatus(id, result.github ? 'applied' : 'approved');
    } catch {
      // Best effort
    }

    return NextResponse.json({
      success: true,
      applied: result,
      status: result.github ? 'applied' : 'approved',
    });
  } catch (error) {
    console.error('Proposal action error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
