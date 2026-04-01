/**
 * Apply an approved proposal — updates both GitHub repo and Featurebase.
 */

import { commitFiles, fetchRepoArticles } from './github-sync';
import { FeaturebaseClient } from './featurebase-client.js';
import matter from 'gray-matter';
import type { EditProposal } from './improve-agent';

interface ApplyResult {
  github: boolean;
  featurebase: boolean;
  githubUrl?: string;
  errors: string[];
}

export async function applyProposal(proposal: EditProposal): Promise<ApplyResult> {
  const result: ApplyResult = { github: false, featurebase: false, errors: [] };

  // 1. Fetch the current article from GitHub
  const articles = await fetchRepoArticles();
  let articleEntry: { path: string; content: string; frontmatter: any } | undefined;
  let featurebaseId: string | undefined;

  for (const [id, a] of articles) {
    if (
      a.frontmatter.slug === proposal.articleSlug ||
      a.frontmatter.title === proposal.articleTitle
    ) {
      articleEntry = a;
      featurebaseId = id;
      break;
    }
  }

  if (!articleEntry || !featurebaseId) {
    result.errors.push(`Article not found in repo: ${proposal.articleSlug}`);
    return result;
  }

  // 2. Apply the text replacement
  const originalContent = articleEntry.content;

  if (!originalContent.includes(proposal.original)) {
    result.errors.push(`Original text not found in article — it may have already been changed.`);
    return result;
  }

  const updatedContent = originalContent.replace(proposal.original, proposal.replacement);

  // 3. Rebuild the full file with frontmatter
  const updatedFile = matter.stringify(updatedContent, {
    ...articleEntry.frontmatter,
    last_updated: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  });

  // 4. Commit to GitHub
  try {
    const commit = await commitFiles(
      [{ path: articleEntry.path, content: updatedFile }],
      `Improve: ${proposal.editType} in "${proposal.articleTitle}"\n\n${proposal.reasoning}`
    );
    result.github = true;
    result.githubUrl = commit.url;
  } catch (err) {
    result.errors.push(`GitHub commit failed: ${(err as Error).message}`);
  }

  // 5. Push to Featurebase
  const apiKey = process.env.FEATUREBASE_API_KEY;
  if (apiKey && featurebaseId) {
    try {
      const client = new FeaturebaseClient(apiKey);
      await client.updateArticle(featurebaseId, {
        title: articleEntry.frontmatter.title,
        body: updatedContent, // Featurebase accepts markdown in body
      });
      result.featurebase = true;
    } catch (err) {
      result.errors.push(`Featurebase update failed: ${(err as Error).message}`);
    }
  } else {
    result.errors.push('FEATUREBASE_API_KEY not configured — skipped Featurebase update');
  }

  return result;
}
