/**
 * Agent Runtime — bare Anthropic SDK with streaming + tool use.
 *
 * Chat-first: every turn is a streaming Claude call. Tools run when the
 * model asks for them; otherwise the agent just chats. Subagents are
 * spawned via the `spawn_subagent` tool, which makes a focused, non-streamed
 * Claude call with a tighter prompt + a smaller toolset.
 *
 * No /tmp materialization: file ops go through the GitHub API directly,
 * with an in-memory cache loaded once per turn.
 */

import Anthropic from '@anthropic-ai/sdk';
import matter from 'gray-matter';
import {
  fetchRepoArticles,
  commitFiles,
} from './github-sync';

const MODEL = 'claude-sonnet-4-5';
const MAX_TOOL_ITERATIONS = 20;
const SUBAGENT_MODEL = 'claude-haiku-4-5';

const FB_BASE_URL = 'https://do.featurebase.app';
const FB_API_VERSION = '2026-01-01.nova';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'list_articles',
    description:
      'List every documentation article in the local repo with its title, slug, collection, and path. Use this first when the user asks broad questions about the docs.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'read_article',
    description:
      'Read the full body of one article. Pass the article slug (preferred) or part of the title.',
    input_schema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Article slug or title fragment' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'search_articles',
    description:
      'Keyword search across all article bodies. Returns matching articles with snippets. Case-insensitive.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords to search for' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'edit_article',
    description:
      'Stage an edit to an article by replacing exact `original` text with `replacement`. Edits are batched in memory until you call `commit_pending_edits`. Pass the article slug.',
    input_schema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Article slug' },
        original: {
          type: 'string',
          description:
            'Exact text in the article body to replace (must appear verbatim, including whitespace)',
        },
        replacement: { type: 'string', description: 'Text to insert in place' },
        reasoning: {
          type: 'string',
          description: 'Brief note on why this change is needed',
        },
      },
      required: ['slug', 'original', 'replacement', 'reasoning'],
    },
  },
  {
    name: 'commit_pending_edits',
    description:
      'Commit all staged article edits to the GitHub repo as a single commit. Returns the commit URL. No-op if nothing is staged.',
    input_schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Commit message describing what changed and why',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'featurebase_list_articles',
    description:
      'List all articles currently published in the Featurebase help center (live state). Each item has id, title, slug, parentId, updatedAt.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'featurebase_get_article',
    description:
      'Fetch the full live article from Featurebase by id. Use to compare what is published vs. the local repo.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Featurebase article id' },
      },
      required: ['id'],
    },
  },
  {
    name: 'featurebase_update_article',
    description:
      'Push an updated article body to Featurebase. The body must be markdown. Call this after committing the local edit, so repo and live stay in sync.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Featurebase article id' },
        title: { type: 'string' },
        body: { type: 'string', description: 'Full article body, markdown' },
      },
      required: ['id', 'title', 'body'],
    },
  },
  {
    name: 'run_changelog_audit',
    description:
      "Run the two-stage AI audit (keyword filter + Claude deep dive) against a changelog entry. Returns the list of articles that contradict or miss information from the changelog. Use when the user wants to verify documentation against a specific product change.",
    input_schema: {
      type: 'object',
      properties: {
        changelog_text: {
          type: 'string',
          description: 'Full text of the changelog entry to audit against',
        },
      },
      required: ['changelog_text'],
    },
  },
  {
    name: 'web_fetch',
    description:
      'Fetch a URL and return its text content. Useful for reading external pages, changelogs, blog posts, etc. that the user references.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Absolute https:// URL to fetch' },
      },
      required: ['url'],
    },
  },
  {
    name: 'spawn_subagent',
    description:
      'Spin up a focused subagent to handle one chunk of a larger task in parallel. Pass a clear, self-contained `task` description and (optionally) a list of article slugs the subagent should focus on. The subagent has read-only tools (read_article, search_articles, web_fetch) and returns a text summary. Use for big tasks like "for each of these 12 articles, summarize key claims" — call multiple times in one turn for parallel exploration.',
    input_schema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Self-contained task for the subagent to perform' },
        focus_slugs: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of article slugs to focus on',
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'notion_search',
    description:
      'Search Notion for a query. (Stub — Notion integration not yet wired up. Returns a not-configured message.)',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
  },
];

const SUBAGENT_TOOLS: Anthropic.Messages.Tool[] = TOOLS.filter((t) =>
  ['list_articles', 'read_article', 'search_articles', 'web_fetch'].includes(t.name)
);

// ---------------------------------------------------------------------------
// Per-turn state — articles cached in memory, edits staged
// ---------------------------------------------------------------------------

interface CachedArticle {
  id: string;
  title: string;
  slug: string;
  collection: string;
  path: string;
  frontmatter: any;
  /** Current body (may include staged edits). */
  body: string;
  /** Original body, for the GitHub commit (frontmatter is preserved on commit). */
  originalBody: string;
  dirty: boolean;
}

export interface AgentRuntime {
  anthropic: Anthropic;
  articles: Map<string, CachedArticle>; // keyed by slug
  byId: Map<string, CachedArticle>;
  byPath: Map<string, CachedArticle>;
  /** Surface tool execution detail to the SSE stream. */
  emit: AgentEmitter;
}

export interface AgentEmitter {
  text(text: string): void;
  toolStart(call: { id: string; name: string; input: unknown }): void;
  toolResult(result: { id: string; text: string; isError: boolean }): void;
  status(message: string): void;
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

type ToolHandler = (input: any, rt: AgentRuntime) => Promise<string>;

const findArticle = (rt: AgentRuntime, slugOrTitle: string): CachedArticle | null => {
  const needle = slugOrTitle.toLowerCase().trim();
  const direct = rt.articles.get(needle);
  if (direct) return direct;
  for (const a of rt.articles.values()) {
    if (a.slug?.toLowerCase() === needle) return a;
    if (a.title?.toLowerCase() === needle) return a;
  }
  for (const a of rt.articles.values()) {
    if (a.title?.toLowerCase().includes(needle) || a.slug?.toLowerCase().includes(needle)) {
      return a;
    }
  }
  return null;
};

const ok = (text: string) => text;
const err = (text: string) => `ERROR: ${text}`;

const handlers: Record<string, ToolHandler> = {
  list_articles: async (_input, rt) => {
    const items = [...rt.articles.values()].map((a) => ({
      title: a.title,
      slug: a.slug,
      collection: a.collection,
      path: a.path,
    }));
    items.sort((a, b) => a.collection.localeCompare(b.collection) || a.title.localeCompare(b.title));
    return ok(JSON.stringify({ count: items.length, articles: items }, null, 2));
  },

  read_article: async ({ slug }, rt) => {
    const article = findArticle(rt, slug);
    if (!article) return err(`Article not found: ${slug}`);
    return ok(
      JSON.stringify(
        {
          title: article.title,
          slug: article.slug,
          collection: article.collection,
          path: article.path,
          last_updated: article.frontmatter.last_updated,
          body: article.body,
        },
        null,
        2
      )
    );
  },

  search_articles: async ({ query, limit = 10 }, rt) => {
    const q = String(query).toLowerCase();
    const matches: { title: string; slug: string; collection: string; snippet: string; score: number }[] = [];
    for (const a of rt.articles.values()) {
      const titleHit = a.title?.toLowerCase().includes(q);
      const slugHit = a.slug?.toLowerCase().includes(q);
      const bodyIdx = a.body.toLowerCase().indexOf(q);
      if (!titleHit && !slugHit && bodyIdx === -1) continue;
      const snippet =
        bodyIdx >= 0
          ? '...' + a.body.slice(Math.max(0, bodyIdx - 60), bodyIdx + 120) + '...'
          : a.body.slice(0, 180) + '...';
      const score = (titleHit ? 3 : 0) + (slugHit ? 2 : 0) + (bodyIdx >= 0 ? 1 : 0);
      matches.push({ title: a.title, slug: a.slug, collection: a.collection, snippet, score });
    }
    matches.sort((a, b) => b.score - a.score);
    return ok(
      JSON.stringify(
        { count: matches.length, results: matches.slice(0, Math.min(50, Number(limit))) },
        null,
        2
      )
    );
  },

  edit_article: async ({ slug, original, replacement, reasoning }, rt) => {
    const article = findArticle(rt, slug);
    if (!article) return err(`Article not found: ${slug}`);
    if (!article.body.includes(original)) {
      return err(
        `The exact \`original\` text was not found in "${article.slug}". The article body has not changed. Re-read the article and try again with verbatim text.`
      );
    }
    article.body = article.body.replace(original, replacement);
    article.dirty = true;
    return ok(
      `Staged edit on "${article.title}" (${article.slug}). Reasoning: ${reasoning}\n\nCall commit_pending_edits to push to GitHub.`
    );
  },

  commit_pending_edits: async ({ message }, rt) => {
    const dirty = [...rt.articles.values()].filter((a) => a.dirty);
    if (dirty.length === 0) return ok('No staged edits — nothing to commit.');

    const files = dirty.map((a) => ({
      path: a.path,
      content: matter.stringify(a.body, {
        ...a.frontmatter,
        last_updated: new Date().toISOString(),
      }),
    }));
    try {
      const commit = await commitFiles(files, `agent: ${message}`);
      // Mark clean post-commit
      for (const a of dirty) {
        a.originalBody = a.body;
        a.dirty = false;
      }
      return ok(
        `Committed ${dirty.length} file(s).\n${commit.url}\n\nFiles:\n${dirty.map((a) => `  - ${a.path}`).join('\n')}`
      );
    } catch (e) {
      return err(`Commit failed: ${(e as Error).message}`);
    }
  },

  featurebase_list_articles: async () => {
    const apiKey = process.env.FEATUREBASE_API_KEY;
    const helpCenterId = process.env.FEATUREBASE_HELP_CENTER_ID;
    if (!apiKey || !helpCenterId) return err('Featurebase API not configured');
    try {
      const res = await fetch(
        `${FB_BASE_URL}/v2/help_center/articles?help_center_id=${helpCenterId}&limit=200`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Featurebase-Version': FB_API_VERSION,
          },
        }
      );
      if (!res.ok) return err(`Featurebase ${res.status}: ${await res.text()}`);
      const data: any = await res.json();
      const articles = (data?.data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        parentId: a.parentId,
        updatedAt: a.updatedAt || a.updated_at,
      }));
      return ok(JSON.stringify({ count: articles.length, articles }, null, 2));
    } catch (e) {
      return err((e as Error).message);
    }
  },

  featurebase_get_article: async ({ id }) => {
    const apiKey = process.env.FEATUREBASE_API_KEY;
    if (!apiKey) return err('Featurebase API not configured');
    try {
      const res = await fetch(`${FB_BASE_URL}/v2/help_center/articles/${id}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Featurebase-Version': FB_API_VERSION,
        },
      });
      if (!res.ok) return err(`Featurebase ${res.status}: ${await res.text()}`);
      const data: any = await res.json();
      return ok(JSON.stringify(data?.data || data, null, 2));
    } catch (e) {
      return err((e as Error).message);
    }
  },

  featurebase_update_article: async ({ id, title, body }) => {
    const apiKey = process.env.FEATUREBASE_API_KEY;
    if (!apiKey) return err('Featurebase API not configured');
    try {
      const res = await fetch(`${FB_BASE_URL}/v2/help_center/articles/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Featurebase-Version': FB_API_VERSION,
        },
        body: JSON.stringify({ title, body }),
      });
      if (!res.ok) return err(`Featurebase ${res.status}: ${await res.text()}`);
      return ok(`Updated Featurebase article ${id} ("${title}")`);
    } catch (e) {
      return err((e as Error).message);
    }
  },

  run_changelog_audit: async ({ changelog_text }) => {
    try {
      const mod: any = await import('./audit-engine-v3.js');
      const result = await mod.runAudit({
        id: 'agent-' + Date.now(),
        title: 'Agent-triggered audit',
        content: changelog_text,
        publishedAt: new Date().toISOString(),
        url: '',
        tags: [],
      });
      return ok(JSON.stringify(result, null, 2));
    } catch (e) {
      return err(`Audit failed: ${(e as Error).message}`);
    }
  },

  web_fetch: async ({ url }) => {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'docs-control-agent/0.1' },
      });
      if (!res.ok) return err(`HTTP ${res.status} fetching ${url}`);
      const text = await res.text();
      // Crude HTML → text fallback
      const stripped = text
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
      return ok(stripped.slice(0, 8000));
    } catch (e) {
      return err((e as Error).message);
    }
  },

  spawn_subagent: async ({ task, focus_slugs }, rt) => {
    rt.emit.status(`Subagent: ${String(task).slice(0, 80)}...`);
    let context = '';
    if (Array.isArray(focus_slugs) && focus_slugs.length > 0) {
      const focusArticles = focus_slugs
        .map((s: string) => findArticle(rt, s))
        .filter(Boolean) as CachedArticle[];
      if (focusArticles.length > 0) {
        context =
          '\n\n# Articles in scope\n\n' +
          focusArticles
            .map(
              (a) =>
                `## ${a.title} (${a.slug})\n\n${a.body.slice(0, 4000)}${
                  a.body.length > 4000 ? '\n[... truncated ...]' : ''
                }`
            )
            .join('\n\n---\n\n');
      }
    }

    const sysPrompt = `You are a focused subagent for the docs-control system. You have read-only tools.
Complete the task below thoroughly and return a clear, well-structured text answer.${context}`;

    try {
      const messages: Anthropic.Messages.MessageParam[] = [
        { role: 'user', content: String(task) },
      ];
      const summary: string[] = [];
      for (let i = 0; i < 8; i++) {
        const resp = await rt.anthropic.messages.create({
          model: SUBAGENT_MODEL,
          max_tokens: 4096,
          system: sysPrompt,
          tools: SUBAGENT_TOOLS,
          messages,
        });
        messages.push({ role: 'assistant', content: resp.content });

        const toolUses = resp.content.filter(
          (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use'
        );
        const text = resp.content
          .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n');
        if (text) summary.push(text);

        if (toolUses.length === 0 || resp.stop_reason === 'end_turn') break;

        const results: Anthropic.Messages.ToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          const handler = handlers[tu.name];
          if (!handler) {
            results.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: `ERROR: subagent has no access to tool ${tu.name}`,
              is_error: true,
            });
            continue;
          }
          try {
            const out = await handler(tu.input, rt);
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: out });
          } catch (e) {
            results.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: `ERROR: ${(e as Error).message}`,
              is_error: true,
            });
          }
        }
        messages.push({ role: 'user', content: results });
      }
      return ok(summary.join('\n\n').trim() || '(subagent returned no text)');
    } catch (e) {
      return err(`Subagent failed: ${(e as Error).message}`);
    }
  },

  notion_search: async ({ query }) => {
    return ok(
      `Notion integration is not configured yet. Search query was: "${query}". Ask the operator to wire up NOTION_API_KEY and a Notion database/workspace, and this tool will be enabled.`
    );
  },
};

// ---------------------------------------------------------------------------
// Setup — load all articles into memory once per turn
// ---------------------------------------------------------------------------

export async function buildRuntime(emit: AgentEmitter): Promise<AgentRuntime> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const repoArticles = await fetchRepoArticles();
  const articles = new Map<string, CachedArticle>();
  const byId = new Map<string, CachedArticle>();
  const byPath = new Map<string, CachedArticle>();
  for (const [fbId, a] of repoArticles) {
    const cached: CachedArticle = {
      id: fbId,
      title: a.frontmatter.title || '',
      slug: a.frontmatter.slug || '',
      collection: a.frontmatter.collection_name || 'Uncategorized',
      path: a.path,
      frontmatter: a.frontmatter,
      body: a.content,
      originalBody: a.content,
      dirty: false,
    };
    if (cached.slug) articles.set(cached.slug.toLowerCase(), cached);
    byId.set(fbId, cached);
    byPath.set(a.path, cached);
  }

  return {
    anthropic: new Anthropic({ apiKey }),
    articles,
    byId,
    byPath,
    emit,
  };
}

// ---------------------------------------------------------------------------
// Streaming chat loop
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the docs-control agent for Sudowrite — an AI-assisted creative writing tool.

# Your job
You help the operator review, audit, and edit the Sudowrite documentation. You're a chat partner first: respond conversationally, ask clarifying questions when needed, and only reach for tools when you actually need them. Don't run tools just to look busy.

# What you have access to
- The full local documentation repo (~85 markdown articles), via list_articles, read_article, search_articles
- Live Featurebase published state, via featurebase_list_articles / get_article / update_article
- Edit + commit: edit_article (stages edits in memory), commit_pending_edits (pushes to GitHub as one commit)
- The two-stage changelog audit, via run_changelog_audit
- Web access, via web_fetch
- Subagents: spawn_subagent (focused, read-only, returns text). Use multiple parallel calls in one turn for big multi-part tasks
- notion_search (stub — not wired up yet)

# Working with edits
When the operator asks you to update an article:
1. read_article to confirm you understand current content
2. edit_article with verbatim original text + replacement
3. Only call commit_pending_edits once you have all edits staged for that turn
4. After committing, optionally call featurebase_update_article to push to live

# Style
- Concise. The operator is technical and busy.
- Don't dump giant tool results back at them; summarize what you found.
- If you make an edit, mention what you changed and why in 1–2 sentences.`;

export interface ChatTurnResult {
  /** Final assistant text the user sees. */
  text: string;
  /** Tool calls executed this turn, in order. */
  toolCalls: { id: string; name: string; input: unknown; result: string; isError: boolean }[];
  /** Whether any commits were made this turn. */
  committed: boolean;
}

export async function runChatTurn(
  rt: AgentRuntime,
  conversationHistory: Anthropic.Messages.MessageParam[],
  newUserMessage: string
): Promise<ChatTurnResult> {
  const messages: Anthropic.Messages.MessageParam[] = [
    ...conversationHistory,
    { role: 'user', content: newUserMessage },
  ];

  const collectedToolCalls: ChatTurnResult['toolCalls'] = [];
  const finalTextBuffer: string[] = [];
  let committed = false;

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    const stream = rt.anthropic.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    // Per-stream accumulation
    type Block =
      | { type: 'text'; text: string }
      | { type: 'tool_use'; id: string; name: string; inputJson: string };
    const blocks: Block[] = [];
    let stopReason: string | null = null;

    for await (const event of stream) {
      switch (event.type) {
        case 'content_block_start': {
          if (event.content_block.type === 'text') {
            blocks[event.index] = { type: 'text', text: '' };
          } else if (event.content_block.type === 'tool_use') {
            blocks[event.index] = {
              type: 'tool_use',
              id: event.content_block.id,
              name: event.content_block.name,
              inputJson: '',
            };
          }
          break;
        }
        case 'content_block_delta': {
          const block = blocks[event.index];
          if (!block) break;
          if (event.delta.type === 'text_delta' && block.type === 'text') {
            block.text += event.delta.text;
            rt.emit.text(event.delta.text);
          } else if (event.delta.type === 'input_json_delta' && block.type === 'tool_use') {
            block.inputJson += event.delta.partial_json;
          }
          break;
        }
        case 'content_block_stop': {
          const block = blocks[event.index];
          if (block?.type === 'tool_use') {
            // Tool call now complete — surface it before we run it
            let parsedInput: unknown = {};
            try {
              parsedInput = block.inputJson ? JSON.parse(block.inputJson) : {};
            } catch {
              parsedInput = { _raw: block.inputJson };
            }
            rt.emit.toolStart({ id: block.id, name: block.name, input: parsedInput });
          }
          break;
        }
        case 'message_delta': {
          if ((event.delta as any).stop_reason) {
            stopReason = (event.delta as any).stop_reason;
          }
          break;
        }
      }
    }

    // Reconstruct the assistant message blocks for the conversation history
    const assistantContent: Anthropic.Messages.ContentBlockParam[] = blocks
      .filter(Boolean)
      .map((b) => {
        if (b.type === 'text') return { type: 'text', text: b.text };
        let parsed: unknown = {};
        try {
          parsed = b.inputJson ? JSON.parse(b.inputJson) : {};
        } catch {
          parsed = {};
        }
        return { type: 'tool_use', id: b.id, name: b.name, input: parsed };
      });

    messages.push({ role: 'assistant', content: assistantContent });

    // Capture text for the final result
    for (const b of blocks) {
      if (b?.type === 'text' && b.text) finalTextBuffer.push(b.text);
    }

    // No tool use → we're done
    const toolUseBlocks = assistantContent.filter(
      (b): b is Anthropic.Messages.ToolUseBlockParam => b.type === 'tool_use'
    );
    if (toolUseBlocks.length === 0 || stopReason === 'end_turn') {
      break;
    }

    // Execute tool calls (in parallel — Claude can request multiple at once)
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (tu) => {
        const handler = handlers[tu.name];
        if (!handler) {
          const errMsg = `Unknown tool: ${tu.name}`;
          rt.emit.toolResult({ id: tu.id, text: errMsg, isError: true });
          collectedToolCalls.push({
            id: tu.id,
            name: tu.name,
            input: tu.input,
            result: errMsg,
            isError: true,
          });
          return {
            type: 'tool_result',
            tool_use_id: tu.id,
            content: errMsg,
            is_error: true,
          };
        }
        try {
          const result = await handler(tu.input, rt);
          const isError = result.startsWith('ERROR:');
          rt.emit.toolResult({ id: tu.id, text: result, isError });
          collectedToolCalls.push({
            id: tu.id,
            name: tu.name,
            input: tu.input,
            result,
            isError,
          });
          if (tu.name === 'commit_pending_edits' && !isError) committed = true;
          return {
            type: 'tool_result',
            tool_use_id: tu.id,
            content: result,
            is_error: isError,
          };
        } catch (e) {
          const errMsg = `ERROR: ${(e as Error).message}`;
          rt.emit.toolResult({ id: tu.id, text: errMsg, isError: true });
          collectedToolCalls.push({
            id: tu.id,
            name: tu.name,
            input: tu.input,
            result: errMsg,
            isError: true,
          });
          return {
            type: 'tool_result',
            tool_use_id: tu.id,
            content: errMsg,
            is_error: true,
          };
        }
      })
    );

    messages.push({ role: 'user', content: toolResults });
  }

  return {
    text: finalTextBuffer.join('').trim(),
    toolCalls: collectedToolCalls,
    committed,
  };
}
