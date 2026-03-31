/**
 * Sync API — pulls latest from Featurebase and applies changes.
 *
 * On Vercel: reads existing articles from GitHub repo API, compares with
 * Featurebase, commits changes via Git Data API (triggers redeploy).
 *
 * Locally: reads/writes files directly on disk.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { commitFiles, buildRepoPath, fetchRepoArticles } from '@/lib/github-sync';
import matter from 'gray-matter';
import crypto from 'crypto';

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

/**
 * Normalize content before hashing — strip ephemeral S3 signed URL params
 * so that only real content changes trigger updates.
 */
function normalizeContent(content: string): string {
  return content.replace(
    /\?X-Amz-[^)\s]*/g,
    ''
  );
}

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(normalizeContent(content)).digest('hex');
}

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

    // Fetch all remote articles from Featurebase
    const remoteResponse = await client.getArticles({
      help_center_id: helpCenterId,
      limit: 100,
    });
    const remoteArticles = remoteResponse?.data || [];

    // Get existing articles — on Vercel, read from GitHub API; locally, read from disk
    let localById: Map<string, { path: string; content: string; frontmatter: any }>;

    if (isVercel) {
      if (!process.env.GITHUB_TOKEN) {
        return NextResponse.json(
          { success: false, error: 'GITHUB_TOKEN not configured' },
          { status: 500 }
        );
      }
      localById = await fetchRepoArticles();
    } else {
      localById = new Map();
      try {
        const localArticles = await sync.scanLocalArticles();
        for (const a of localArticles) {
          localById.set(a.id, { path: a.path, content: a.content, frontmatter: a.frontmatter });
        }
      } catch {
        // Empty on first run
      }
    }

    const results = {
      updated: 0,
      created: 0,
      matched: 0,
      details: [] as string[],
    };

    const filesToCommit: { path: string; content: string }[] = [];

    for (const remoteArticle of remoteArticles) {
      try {
        const collectionName = remoteArticle.parentId
          ? collectionMap[remoteArticle.parentId] || 'Uncategorized'
          : 'Uncategorized';

        const remoteMarkdown = sync.extractArticleContent(remoteArticle);
        const remoteHash = hashContent(remoteMarkdown);

        const local = localById.get(remoteArticle.id);

        if (!local) {
          // New article
          const repoPath = buildRepoPath(hierarchy, remoteArticle.parentId, remoteArticle.title);

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

        // Existing — compare content
        const localHash = hashContent(local.content);

        if (remoteHash === localHash) {
          results.matched++;
          continue;
        }

        // Content changed — update
        const fileContent = matter.stringify(remoteMarkdown, {
          ...local.frontmatter,
          last_updated: remoteArticle.updatedAt || remoteArticle.updated_at || new Date().toISOString(),
          synced_at: new Date().toISOString(),
          source: 'featurebase',
        });

        filesToCommit.push({ path: local.path, content: fileContent });
        results.updated++;
        results.details.push(`Updated: ${remoteArticle.title}`);
      } catch (err) {
        results.details.push(`Error: ${remoteArticle.title} — ${(err as Error).message}`);
      }
    }

    if (filesToCommit.length === 0) {
      return NextResponse.json({
        success: true,
        message: `All ${results.matched} articles are in sync. No changes needed.`,
        results,
        remoteCount: remoteArticles.length,
        localCount: localById.size,
      });
    }

    if (isVercel) {
      const commit = await commitFiles(
        filesToCommit,
        `Sync ${results.updated} updated, ${results.created} new articles from Featurebase`
      );

      return NextResponse.json({
        success: true,
        message: `Synced ${results.updated} updated + ${results.created} new articles. Committed to GitHub.`,
        results,
        commit: commit.url,
        remoteCount: remoteArticles.length,
        localCount: localById.size,
      });
    } else {
      // Local dev — write files directly
      const path = require('path');
      const fs = require('fs/promises');
      const syncState = await sync.loadSyncState();

      for (const file of filesToCommit) {
        const fullPath = path.resolve(file.path);
        const dir = path.dirname(fullPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(fullPath, file.content, 'utf-8');
      }

      syncState.last_sync = new Date().toISOString();
      await sync.saveSyncState(syncState);

      return NextResponse.json({
        success: true,
        message: `Synced ${results.updated} updated + ${results.created} new articles locally.`,
        results,
        remoteCount: remoteArticles.length,
        localCount: localById.size,
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
