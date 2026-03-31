/**
 * Sync API — compares Featurebase articles with local repo state.
 *
 * On Vercel (read-only filesystem): runs in compare mode — fetches remote,
 * reads deployed local files, and reports differences.
 *
 * Locally (next dev): runs full read/write sync.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const maxDuration = 300;

const getClient = async () => {
  const mod = await import('@/lib/featurebase-client.js');
  return mod.FeaturebaseClient;
};

const getSync = async (): Promise<any> => {
  const mod = await import('@/lib/featurebase-sync.js');
  return mod;
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

    const client = new FeaturebaseClient(apiKey);

    // Test connection
    const testResult = await client.testConnection();
    if (!testResult.success) {
      return NextResponse.json(
        { success: false, error: `Featurebase connection failed: ${testResult.error}` },
        { status: 500 }
      );
    }

    // Fetch collections
    const collectionsResponse = await client.getCollections({
      help_center_id: helpCenterId,
      limit: 100,
    });
    const collections = collectionsResponse?.data || [];
    const collectionMap: Record<string, string> = {};
    collections.forEach((col: any) => {
      collectionMap[col.id] = col.name || col.translations?.en?.name || 'Uncategorized';
    });

    // Fetch remote articles
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
      // If local scan fails on Vercel, continue with empty
    }

    const localById = new Map<string, any>();
    for (const a of localArticles) {
      localById.set(a.id, a);
    }

    const results = {
      matched: 0,
      changed: 0,
      newRemote: 0,
      details: [] as string[],
      mode: isVercel ? 'compare' : 'full-sync',
    };

    if (isVercel) {
      // === COMPARE MODE (Vercel — read-only) ===
      for (const remoteArticle of remoteArticles) {
        const collectionName = remoteArticle.parentId
          ? collectionMap[remoteArticle.parentId] || 'Uncategorized'
          : 'Uncategorized';

        const local = localById.get(remoteArticle.id);

        if (!local) {
          results.newRemote++;
          results.details.push(`New on Featurebase: ${remoteArticle.title} (${collectionName})`);
          continue;
        }

        // Compare content by extracting remote markdown
        const remoteContent = sync.extractArticleContent(remoteArticle);
        const remoteHash = sync.hashContent(remoteContent);
        const localHash = sync.hashContent(local.content);

        if (remoteHash !== localHash) {
          results.changed++;
          results.details.push(`Changed: ${remoteArticle.title}`);
        } else {
          results.matched++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Sync check: ${results.matched} matched, ${results.changed} changed on Featurebase, ${results.newRemote} new articles. Run locally to apply changes.`,
        results,
        remoteCount: remoteArticles.length,
        localCount: localArticles.length,
      });
    }

    // === FULL SYNC MODE (local dev — read/write) ===
    const syncState = await sync.loadSyncState();

    const fullResults = {
      ...results,
      pulled: 0,
      created: 0,
      skipped: 0,
      conflicts: 0,
      errors: 0,
    };

    for (const remoteArticle of remoteArticles) {
      try {
        const collectionName = remoteArticle.parentId
          ? collectionMap[remoteArticle.parentId] || 'Uncategorized'
          : 'Uncategorized';

        const localArticle = await sync.findLocalArticleById(remoteArticle.id);

        if (!localArticle) {
          const { article, filePath } = await sync.createLocalArticle(remoteArticle, collectionName);
          syncState.articles[article.id] = {
            local_path: filePath,
            remote_id: article.id,
            last_synced_at: new Date().toISOString(),
            last_synced_hash: sync.hashContent(article.content),
            sync_direction: 'pull',
            status: 'synced',
          };
          fullResults.created++;
          fullResults.details.push(`Created: ${article.title}`);
          continue;
        }

        const lastSync = syncState.articles[remoteArticle.id];

        if (!lastSync) {
          await sync.updateLocalArticle(localArticle.path, remoteArticle, collectionName);
          syncState.articles[remoteArticle.id] = {
            local_path: localArticle.path,
            remote_id: remoteArticle.id,
            last_synced_at: new Date().toISOString(),
            last_synced_hash: sync.hashContent(localArticle.content),
            sync_direction: 'pull',
            status: 'synced',
          };
          fullResults.pulled++;
          fullResults.details.push(`Pulled: ${remoteArticle.title}`);
          continue;
        }

        const remoteUpdatedAt = new Date(remoteArticle.updatedAt || remoteArticle.updated_at);
        const lastSyncedAt = new Date(lastSync.last_synced_at);

        if (remoteUpdatedAt <= lastSyncedAt) {
          fullResults.skipped++;
          continue;
        }

        const localHash = sync.hashContent(localArticle.content);
        const localChanged = localHash !== lastSync.last_synced_hash;

        if (localChanged) {
          const { report } = await sync.handleConflict(localArticle, remoteArticle, 'pull');
          syncState.conflicts = syncState.conflicts || [];
          syncState.conflicts.push(report);
          fullResults.conflicts++;
          fullResults.details.push(`Conflict: ${remoteArticle.title} (${report.resolution})`);

          if (report.resolution === 'used_remote') {
            await sync.updateLocalArticle(localArticle.path, remoteArticle, collectionName);
          }
        } else {
          await sync.updateLocalArticle(localArticle.path, remoteArticle, collectionName);
          fullResults.pulled++;
          fullResults.details.push(`Pulled: ${remoteArticle.title}`);
        }

        syncState.articles[remoteArticle.id] = {
          local_path: localArticle.path,
          remote_id: remoteArticle.id,
          last_synced_at: new Date().toISOString(),
          last_synced_hash: sync.hashContent(localArticle.content),
          sync_direction: 'pull',
          status: localChanged ? 'conflict_resolved' : 'synced',
        };
      } catch (err) {
        fullResults.errors++;
        fullResults.details.push(`Error: ${remoteArticle.title} — ${(err as Error).message}`);
      }
    }

    syncState.last_sync = new Date().toISOString();
    await sync.saveSyncState(syncState);

    return NextResponse.json({
      success: true,
      message: `Sync complete: ${fullResults.pulled} pulled, ${fullResults.created} created, ${fullResults.skipped} unchanged, ${fullResults.conflicts} conflicts, ${fullResults.errors} errors`,
      results: fullResults,
      remoteCount: remoteArticles.length,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
