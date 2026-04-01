/**
 * Public docs endpoint — serves the documentation inventory.
 * No auth required. Read-only.
 *
 * GET /api/docs — article index with titles, slugs, collections
 * GET /api/docs?format=llmstxt — llms.txt format for AI discovery
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchRepoArticles } from '@/lib/github-sync';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format');

  try {
    const articles = await fetchRepoArticles();

    const inventory = Array.from(articles.entries()).map(([id, a]) => ({
      id,
      title: a.frontmatter.title,
      slug: a.frontmatter.slug,
      collection: a.frontmatter.collection_name,
      last_updated: a.frontmatter.last_updated,
    }));

    if (format === 'llmstxt') {
      // Serve as plain text in llms.txt format
      let text = `# Sudowrite Documentation\n`;
      text += `> AI-powered creative writing tool documentation\n\n`;
      text += `## Articles (${inventory.length})\n\n`;

      // Group by collection
      const byCollection = new Map<string, typeof inventory>();
      for (const a of inventory) {
        const col = a.collection || 'Uncategorized';
        if (!byCollection.has(col)) byCollection.set(col, []);
        byCollection.get(col)!.push(a);
      }

      for (const [col, articles] of byCollection) {
        text += `### ${col}\n`;
        for (const a of articles) {
          text += `- [${a.title}](https://docs.sudowrite.com/en/articles/${a.slug})\n`;
        }
        text += `\n`;
      }

      text += `## API Access\n\n`;
      text += `Authenticated agents can access full article content and trigger operations:\n`;
      text += `- GET /api/agent/docs — full inventory with metadata\n`;
      text += `- GET /api/agent/docs?slug=<slug> — specific article content\n`;
      text += `- POST /api/agent/sync — trigger Featurebase sync\n`;
      text += `- POST /api/agent/audit — run changelog audit\n`;
      text += `\nAuthentication: Bearer token (swdc_*). Request access from the Sudowrite docs team.\n`;

      return new NextResponse(text, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    return NextResponse.json({
      name: 'Sudowrite Documentation',
      description: 'Help center articles for Sudowrite, an AI creative writing tool',
      total: inventory.length,
      articles: inventory,
      api: {
        public: {
          index: 'GET /api/docs',
          llmstxt: 'GET /api/docs?format=llmstxt',
        },
        authenticated: {
          docs: 'GET /api/agent/docs',
          article: 'GET /api/agent/docs?slug=<slug>',
          sync: 'POST /api/agent/sync',
          audit: 'POST /api/agent/audit',
        },
        auth: 'Authorization: Bearer swdc_<token>',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
