/**
 * GitHub Sync — commit file changes to the repo via GitHub API.
 * Used on Vercel where the filesystem is read-only.
 */

import { Octokit } from '@octokit/rest';
import matter from 'gray-matter';

const REPO_OWNER = 'mcstew';
const REPO_NAME = 'sw-docs-control';
const BRANCH = 'main';
const DOCS_PREFIX = 'sudowrite-documentation';

interface FileChange {
  path: string;
  content: string;
}

function getOctokit() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not configured');
  return new Octokit({ auth: token });
}

/**
 * Get the current HEAD SHA for the branch
 */
async function getHeadSha(octokit: Octokit): Promise<string> {
  const { data } = await octokit.git.getRef({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    ref: `heads/${BRANCH}`,
  });
  return data.object.sha;
}

/**
 * Get the tree SHA from a commit
 */
async function getTreeSha(octokit: Octokit, commitSha: string): Promise<string> {
  const { data } = await octokit.git.getCommit({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    commit_sha: commitSha,
  });
  return data.tree.sha;
}

/**
 * Create blobs for all changed files
 */
async function createBlobs(
  octokit: Octokit,
  files: FileChange[]
): Promise<{ path: string; sha: string }[]> {
  const blobs = [];
  for (const file of files) {
    const { data } = await octokit.git.createBlob({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      content: Buffer.from(file.content).toString('base64'),
      encoding: 'base64',
    });
    blobs.push({ path: file.path, sha: data.sha });
  }
  return blobs;
}

/**
 * Commit multiple file changes in a single commit via the Git Data API.
 * This creates blobs → tree → commit → updates the branch ref.
 */
export async function commitFiles(
  files: FileChange[],
  message: string
): Promise<{ sha: string; url: string }> {
  if (files.length === 0) {
    throw new Error('No files to commit');
  }

  const octokit = getOctokit();

  // 1. Get current HEAD
  const headSha = await getHeadSha(octokit);
  const baseTreeSha = await getTreeSha(octokit, headSha);

  // 2. Create blobs for all files
  const blobs = await createBlobs(octokit, files);

  // 3. Create a new tree with the changes
  const { data: newTree } = await octokit.git.createTree({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    base_tree: baseTreeSha,
    tree: blobs.map((blob) => ({
      path: blob.path,
      mode: '100644' as const,
      type: 'blob' as const,
      sha: blob.sha,
    })),
  });

  // 4. Create a new commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    message,
    tree: newTree.sha,
    parents: [headSha],
  });

  // 5. Update the branch ref to point to the new commit
  await octokit.git.updateRef({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    ref: `heads/${BRANCH}`,
    sha: newCommit.sha,
  });

  return {
    sha: newCommit.sha,
    url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/commit/${newCommit.sha}`,
  };
}

/**
 * Fetch all markdown files from the repo's sudowrite-documentation/ tree.
 * Returns a map of featurebase_id → { path, content, frontmatter }.
 */
export async function fetchRepoArticles(): Promise<
  Map<string, { path: string; content: string; frontmatter: any }>
> {
  const octokit = getOctokit();
  const articles = new Map<string, { path: string; content: string; frontmatter: any }>();

  // Get the full tree recursively
  const headSha = await getHeadSha(octokit);
  const { data: tree } = await octokit.git.getTree({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    tree_sha: headSha,
    recursive: 'true',
  });

  // Filter to markdown files in sudowrite-documentation/
  const mdFiles = tree.tree.filter(
    (item) =>
      item.type === 'blob' &&
      item.path?.startsWith(DOCS_PREFIX + '/') &&
      item.path?.endsWith('.md') &&
      !item.path?.includes('/.') &&
      !item.path?.endsWith('INDEX.md')
  );

  // Fetch each file's content
  for (const file of mdFiles) {
    if (!file.sha || !file.path) continue;
    try {
      const { data: blob } = await octokit.git.getBlob({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        file_sha: file.sha,
      });

      const raw = Buffer.from(blob.content, 'base64').toString('utf-8');
      const { data: fm, content: body } = matter(raw);

      if (fm.featurebase_id) {
        articles.set(String(fm.featurebase_id), {
          path: file.path,
          content: body,
          frontmatter: fm,
        });
      }
    } catch {
      // Skip files that fail to parse
    }
  }

  return articles;
}

/**
 * Build the file path inside the repo for a given article
 */
export function buildRepoPath(
  collectionHierarchy: Record<string, { main: string; sub: string | null }>,
  parentId: string | null,
  title: string
): string {
  const filename = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-') + '.md';

  if (!parentId || !collectionHierarchy[parentId]) {
    return `${DOCS_PREFIX}/uncategorized/${filename}`;
  }

  const { main, sub } = collectionHierarchy[parentId];
  if (sub) {
    return `${DOCS_PREFIX}/${main}/${sub}/${filename}`;
  }
  return `${DOCS_PREFIX}/${main}/${filename}`;
}
