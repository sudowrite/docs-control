/**
 * Stats API — returns live article count and sync status.
 * On Vercel: counts articles via GitHub API, gets last sync from recent commits.
 */

import { NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

const isVercel = !!process.env.VERCEL;

const getSync = async (): Promise<any> => {
  const mod = await import('@/lib/featurebase-sync.js');
  return mod;
};

export async function GET() {
  try {
    if (isVercel) {
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        return NextResponse.json({ success: true, total_articles: 0, last_sync: null, mode: 'vercel-no-token' });
      }

      const octokit = new Octokit({ auth: token });

      // Count articles by listing the tree
      const { data: ref } = await octokit.git.getRef({
        owner: 'sudowrite',
        repo: 'docs-control',
        ref: 'heads/main',
      });

      const { data: tree } = await octokit.git.getTree({
        owner: 'sudowrite',
        repo: 'docs-control',
        tree_sha: ref.object.sha,
        recursive: 'true',
      });

      const mdFiles = tree.tree.filter(
        (item) =>
          item.type === 'blob' &&
          item.path?.startsWith('sudowrite-documentation/') &&
          item.path?.endsWith('.md') &&
          !item.path?.includes('/.') &&
          !item.path?.endsWith('INDEX.md')
      );

      // Get last sync time from recent commits
      const { data: commits } = await octokit.repos.listCommits({
        owner: 'sudowrite',
        repo: 'docs-control',
        per_page: 10,
      });

      const syncCommit = commits.find((c) =>
        c.commit.message.startsWith('Sync ')
      );

      return NextResponse.json({
        success: true,
        total_articles: mdFiles.length,
        synced_articles: mdFiles.length,
        last_sync: syncCommit?.commit.committer?.date || null,
        conflicts: 0,
        unsynced_articles: 0,
        mode: 'vercel',
      });
    }

    // Local dev — full stats from sync state
    const sync = await getSync();
    const stats = await sync.getSyncStats();
    return NextResponse.json({ success: true, ...stats });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
