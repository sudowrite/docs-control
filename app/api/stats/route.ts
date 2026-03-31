/**
 * Stats API — returns live article count and sync status.
 * Works on both Vercel (scans deployed files) and local dev (full sync state).
 */

import { NextResponse } from 'next/server';

const isVercel = !!process.env.VERCEL;

const getSync = async (): Promise<any> => {
  const mod = await import('@/lib/featurebase-sync.js');
  return mod;
};

export async function GET() {
  try {
    const sync = await getSync();

    // scanLocalArticles reads the filesystem (works on Vercel — files are deployed read-only)
    let totalArticles = 0;
    try {
      const articles = await sync.scanLocalArticles();
      totalArticles = articles.length;
    } catch {
      totalArticles = 0;
    }

    if (isVercel) {
      // On Vercel, no .sync-state.json exists — return what we can
      return NextResponse.json({
        success: true,
        total_articles: totalArticles,
        synced_articles: totalArticles,
        last_sync: null,
        conflicts: 0,
        unsynced_articles: 0,
        mode: 'vercel',
      });
    }

    // Local dev — full stats from sync state
    const stats = await sync.getSyncStats();
    return NextResponse.json({ success: true, ...stats });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
