/**
 * Agent docs endpoint — returns current documentation state for agent consumption.
 * Authenticated via Bearer token.
 *
 * GET /api/agent/docs — full article inventory with metadata
 * GET /api/agent/docs?slug=write — specific article content
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { fetchRepoArticles } from '@/lib/github-sync';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer swdc_...' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');

  try {
    const articles = await fetchRepoArticles();

    if (slug) {
      // Find specific article by slug
      for (const [id, article] of articles) {
        if (article.frontmatter.slug === slug || article.path.includes(slug)) {
          return NextResponse.json({
            success: true,
            article: {
              id,
              title: article.frontmatter.title,
              slug: article.frontmatter.slug,
              collection: article.frontmatter.collection_name,
              path: article.path,
              last_updated: article.frontmatter.last_updated,
              content: article.content,
            },
          });
        }
      }
      return NextResponse.json({ error: `Article not found: ${slug}` }, { status: 404 });
    }

    // Return full inventory
    const inventory = Array.from(articles.entries()).map(([id, a]) => ({
      id,
      title: a.frontmatter.title,
      slug: a.frontmatter.slug,
      collection: a.frontmatter.collection_name,
      path: a.path,
      last_updated: a.frontmatter.last_updated,
    }));

    return NextResponse.json({
      success: true,
      total: inventory.length,
      articles: inventory,
      endpoints: {
        sync: 'POST /api/agent/sync',
        audit: 'POST /api/agent/audit { "changelogText": "..." }',
        docs: 'GET /api/agent/docs',
        article: 'GET /api/agent/docs?slug=<slug>',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
