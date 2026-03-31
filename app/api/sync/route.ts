/**
 * Sync API — pulls latest from Featurebase and applies changes.
 *
 * On Vercel: fetches remote articles, compares with deployed files,
 * commits changes to GitHub repo via API (triggers redeploy).
 *
 * Locally: runs full filesystem read/write sync.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { commitFiles, buildRepoPath } from '@/lib/github-sync';
import matter from 'gray-matter';

export const maxDuration = 300;

const getClient = async () => {
  const mod = await import('@/lib/featurebase-client.js');
  return mod.FeaturebaseClient;
};

const getSync = async (): Promise<any> => {
  const mod = await import('@/lib/featurebase-sync.js');
  return mod;
};

const getHierarchy = async () => {
  const mod = await import('@/lib/collection-hierarchy.js');
  return mod.COLLECTION_HIERARCHY;
};

const isVercel = !!process.env.VERCEL;

export async function POST() {
  const session = await auth();
  const isDev = process.env.NODE_ENV === 'development';
  const oauthConfigured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

  if (!session?.user && !(isDev && !oauthConfigured)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.FEATUREBASE_API_KEY;
  const helpCenterId = process.env.FEATUREBASE_HELP_CENTER_ID;

  if (!apiKey || !helpCenterId) {
    return NextResponse.json(
      { success: false, error: 'Featurebase API not configured' },
      { status: 500 }
    );
  }

  try {
    const FeaturebaseClient = await getClient();
    const sync = await getSync();
    const hierarchy = await getHierarchy();

    const client = new FeaturebaseClient(apiKey);

    // Test connection
    const testResult = await client.testConnection();
    if (!testResult.success) {
      return NextResponse.json(
        { success: false, error: `Featurebase connection failed: ${testResult.error}` },
        { status: 500 }
      );
    }

    // Fetch collections for name mapping
    const collectionsResponse = await client.getCollections({
      help_center_id: helpCenterId,
      limit: 100,
    });
    const collections = collectionsResponse?.data || [];
    const collectionMap: Record<string, string> = {};
    collections.forEach((col: any) => {
      collectionMap[col.id] = col.name || col.translations?.en?.name || 'Uncategorized';
    });

    // Fetch all remote articles
    const remoteResponse = await client.getArticles({
      help_center_id: helpCenterId,
      limit: 100,
    });
    const remoteArticles = remoteResponse?.data || [];

    // Scan local articles (readable on both Vercel and local)
    let localArticles: any[] = [];
    try {
      localArticles = await sync.scanLocalArticles();
    } catch {
      // Empty on first deploy
    }

    const localById = new Map<string, any>();
    for (const a of localArticles) {
      localById.set(a.id, a);
    }

    const results = {
      updated: 0,
      created: 0,
      matched: 0,
      details: [] as string[],
    };

    // Files to commit via GitHub API (Vercel) or write locally
    const filesToCommit: { path: string; content: string }[] = [];

    for (const remoteArticle of remoteArticles) {
      try {
        const collectionName = remoteArticle.parentId
          ? collectionMap[remoteArticle.parentId] || 'Uncategorized'
          : 'Uncategorized';

        // Extract and convert remote content
        const remoteMarkdown = sync.extractArticleContent(remoteArticle);
        const remoteHash = sync.hashContent(remoteMarkdown);

        const local = localById.get(remoteArticle.id);

        if (!local) {
          // New article — needs to be created
          const repoPath = buildRepoPath(
            hierarchy,
            remoteArticle.parentId,
            remoteArticle.title
          );

          const fileContent = matter.stringify(remoteMarkdown, {
            title: remoteArticle.title,
            slug: remoteArticle.slug,
            category: remoteArticle.parentId || '',
            collection_name: collectionName,
            featurebase_id: remoteArticle.id,
            last_updated: remoteArticle.updatedAt || remoteArticle.updated_at || new Date().toISOString(),
            synced_at: new Date().toISOString(),
            source: 'featurebase',
          });

          filesToCommit.push({ path: repoPath, content: fileContent });
          results.created++;
          results.details.push(`New: ${remoteArticle.title}`);
          continue;
        }

        // Existing article — check if changed
        const localHash = sync.hashContent(local.content);

        if (remoteHash === localHash) {
          results.matched++;
          continue;
        }

        // Content differs — update
        const repoPath = local.path.replace(/^.*?sudowrite-documentation/, 'sudowrite-documentation');

        const fileContent = matter.stringify(remoteMarkdown, {
          ...local.frontmatter,
          last_updated: remoteArticle.updatedAt || remoteArticle.updated_at || new Date().toISOString(),
          synced_at: new Date().toISOString(),
          source: 'featurebase',
        });

        filesToCommit.push({ path: repoPath, content: fileContent });
        results.updated++;
        results.details.push(`Updated: ${remoteArticle.title}`);
      } catch (err) {
        results.details.push(`Error: ${remoteArticle.title} — ${(err as Error).message}`);
      }
    }

    // Apply changes
    if (filesToCommit.length === 0) {
      return NextResponse.json({
        success: true,
        message: `All ${results.matched} articles are in sync. No changes needed.`,
        results,
        remoteCount: remoteArticles.length,
        localCount: localArticles.length,
      });
    }

    if (isVercel) {
      // Commit via GitHub API
      if (!process.env.GITHUB_TOKEN) {
        return NextResponse.json({
          success: false,
          error: `Found ${filesToCommit.length} changes but GITHUB_TOKEN not configured. Cannot commit.`,
          results,
        }, { status: 500 });
      }

      const commit = await commitFiles(
        filesToCommit,
        `Sync ${results.updated} updated, ${results.created} new articles from Featurebase`
      );

      return NextResponse.json({
        success: true,
        message: `Synced ${results.updated} updated + ${results.created} new articles. Committed to GitHub — redeploy will follow.`,
        results,
        commit: commit.url,
        remoteCount: remoteArticles.length,
        localCount: localArticles.length,
      });
    } else {
      // Local dev — write files directly
      const syncState = await sync.loadSyncState();

      for (const file of filesToCommit) {
        const fullPath = require('path').resolve(file.path);
        const dir = require('path').dirname(fullPath);
        await require('fs/promises').mkdir(dir, { recursive: true });
        await require('fs/promises').writeFile(fullPath, file.content, 'utf-8');
      }

      syncState.last_sync = new Date().toISOString();
      await sync.saveSyncState(syncState);

      return NextResponse.json({
        success: true,
        message: `Synced ${results.updated} updated + ${results.created} new articles locally.`,
        results,
        remoteCount: remoteArticles.length,
        localCount: localArticles.length,
      });
    }
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
