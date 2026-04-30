/**
 * Chat stream — runs one agent turn against an existing thread and streams
 * SDK events back to the browser as Server-Sent Events.
 *
 * Per turn:
 *   1. Load thread, append the user message
 *   2. Materialize the docs repo into /tmp/<threadId>
 *   3. Build the in-process MCP server with workspace-aware tools
 *   4. Pipe the prior conversation + new message into query()
 *   5. Stream every SDK message back as a typed SSE event
 *   6. After result, snapshot the assistant turn into the thread + persist
 */

import { NextRequest } from 'next/server';
import path from 'path';
import { auth } from '@/lib/auth';
import {
  loadThread,
  saveThread,
  newThread,
  generateThreadTitle,
  type ChatThread,
  type ChatMessage,
} from '@/lib/chat-threads';
import {
  materializeWorkspace,
  cleanupWorkspace,
} from '@/lib/agent-workspace';
import { buildAgentToolsServer } from '@/lib/agent-tools';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * System prompt — defines the agent's identity, the working directory layout,
 * and which tools it should reach for first.
 */
const SYSTEM_PROMPT = `You are the docs-control agent, an autonomous documentation assistant for Sudowrite (an AI creative writing tool).

# Your environment

You are working inside a temporary workspace at the current working directory. Inside it, the full Sudowrite documentation repo is materialized at \`sudowrite-documentation/\` — a tree of markdown files organized by collection (getting-started, plans-and-account, using-sudowrite, resources, frequently-asked-questions, legal-stuff, about-sudowrite). A flat \`INDEX.txt\` at the root lists every article path.

Each markdown file has YAML frontmatter with: title, slug, category, collection_name, featurebase_id, last_updated, synced_at, source. Edit only the body; preserve the frontmatter.

# Your tools

You have all the standard file tools — Read, Edit, Write, Glob, Grep — for working with the local repo, plus WebSearch and WebFetch for outside research, plus the Agent tool for spawning focused subagents on big sub-tasks.

You also have these docs-control specific MCP tools:
- \`mcp__docs-control__featurebase_list_articles\` — what's currently published live
- \`mcp__docs-control__featurebase_get_article\` — full body of a live article
- \`mcp__docs-control__featurebase_list_collections\` — the live category tree
- \`mcp__docs-control__featurebase_update_article\` — push an edit to Featurebase
- \`mcp__docs-control__run_changelog_audit\` — invoke the two-stage audit on a changelog entry
- \`mcp__docs-control__commit_workspace\` — commit any local edits you've made back to the GitHub repo

# Your default workflow

1. Use Glob/Grep on \`sudowrite-documentation/\` to find what you need. The local repo is the source of truth — start there.
2. For broad questions, spawn subagents (one per area) instead of trying to read everything yourself.
3. When the user asks for changes: Edit the files locally first, call \`commit_workspace\` to push to GitHub, then optionally call \`featurebase_update_article\` to push to live docs.
4. Be concise in your replies. Show your work via tool calls; explain only when explanation is needed.`;

/**
 * Build the rolling conversation prompt the SDK expects.
 *
 * The Agent SDK accepts a single string `prompt` that becomes the user turn.
 * We prepend a transcript of prior messages so the model sees the history.
 * (For the first turn, we just pass the user message.)
 */
function buildPrompt(thread: ChatThread, newUserText: string): string {
  if (thread.messages.length === 0) {
    return newUserText;
  }
  const transcript = thread.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      const role = m.role === 'user' ? 'User' : 'Assistant';
      return `<turn role="${role}">\n${m.text}\n</turn>`;
    })
    .join('\n\n');
  return `<conversation_history>\n${transcript}\n</conversation_history>\n\n<current_message>\n${newUserText}\n</current_message>`;
}

/**
 * SSE encoder — every event is a JSON payload on a `data:` line.
 */
function sseEvent(event: string, payload: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const isDev = process.env.NODE_ENV === 'development';
  const oauthConfigured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
  if (!session?.user && !(isDev && !oauthConfigured)) {
    return new Response('Unauthorized', { status: 401 });
  }
  const userEmail = session?.user?.email || 'dev@sudowrite.com';

  const body = (await req.json()) as { threadId?: string; message: string };
  if (!body.message?.trim()) {
    return new Response('Missing message', { status: 400 });
  }

  // Load or create thread
  let thread: ChatThread;
  if (body.threadId) {
    const loaded = await loadThread(body.threadId);
    thread = loaded ?? newThread(userEmail);
    if (!loaded) thread.id = body.threadId; // preserve client-chosen id
  } else {
    thread = newThread(userEmail);
  }

  // First-message → derive title
  if (thread.messages.length === 0) {
    thread.title = generateThreadTitle(body.message);
  }

  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    text: body.message,
    createdAt: new Date().toISOString(),
  };
  thread.messages.push(userMessage);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, payload: unknown) => {
        try {
          controller.enqueue(encoder.encode(sseEvent(event, payload)));
        } catch {
          // controller already closed
        }
      };

      let workspaceCwd: string | null = null;
      const assistantTextBuffer: string[] = [];
      const toolCallsThisTurn: ChatMessage[] = [];
      let resultSummary = '';
      const seenMessageTypes = new Set<string>();

      try {
        send('thread', { id: thread.id, title: thread.title });
        send('user_message', userMessage);

        send('status', { phase: 'materializing', message: 'Pulling repo into workspace...' });
        const manifest = await materializeWorkspace(thread.id);
        workspaceCwd = manifest.cwd;

        send('status', {
          phase: 'thinking',
          message: `Workspace ready at ${path.relative('/tmp', workspaceCwd)} — running agent...`,
        });

        // Lazy import the SDK so the route only pays the cost when used
        const { query } = await import('@anthropic-ai/claude-agent-sdk');
        const mcpServer = buildAgentToolsServer(manifest);

        const agentQuery = query({
          prompt: buildPrompt(thread, body.message),
          options: {
            cwd: manifest.cwd,
            systemPrompt: SYSTEM_PROMPT,
            // Built-in tools we want available
            tools: ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Agent'],
            // Auto-approve everything — this is a server-side autonomous agent
            permissionMode: 'bypassPermissions',
            mcpServers: { 'docs-control': mcpServer },
            // Don't use the local Claude Code config — keep this hermetic
            settingSources: [],
          } as any,
        });

        for await (const sdkMessage of agentQuery) {
          // Diagnostic: log every SDK message type seen this turn (server-side
          // only). Helps confirm the streaming wiring on Vercel.
          if (!seenMessageTypes.has(sdkMessage.type)) {
            seenMessageTypes.add(sdkMessage.type);
            console.log(
              `[chat] SDK message type: ${sdkMessage.type}` +
                ((sdkMessage as any).subtype
                  ? ` (subtype=${(sdkMessage as any).subtype})`
                  : '')
            );
          }
          // Map SDK message types onto SSE events the client cares about.
          switch (sdkMessage.type) {
            case 'system': {
              if ((sdkMessage as any).subtype === 'init') {
                send('agent_init', {
                  tools: (sdkMessage as any).tools,
                  model: (sdkMessage as any).model,
                });
              }
              break;
            }
            case 'assistant': {
              const am = sdkMessage as any;
              const blocks = am.message?.content || [];
              if (blocks.length === 0) {
                console.log(
                  `[chat] assistant message had no content blocks. keys=${Object.keys(
                    am.message || {}
                  ).join(',')}`
                );
              }
              for (const block of blocks) {
                if (block.type === 'text') {
                  assistantTextBuffer.push(block.text);
                  send('text', { text: block.text });
                } else if (block.type === 'tool_use') {
                  const toolMsg: ChatMessage = {
                    id: crypto.randomUUID(),
                    role: 'tool',
                    text: `${block.name}`,
                    toolCall: { name: block.name, input: block.input },
                    createdAt: new Date().toISOString(),
                  };
                  toolCallsThisTurn.push(toolMsg);
                  send('tool_call', { id: block.id, name: block.name, input: block.input });
                }
              }
              break;
            }
            case 'user': {
              // user-typed messages from inside the SDK are tool results in our flow
              const blocks = (sdkMessage as any).message?.content || [];
              for (const block of blocks) {
                if (block.type === 'tool_result') {
                  const resultText =
                    typeof block.content === 'string'
                      ? block.content
                      : (block.content || [])
                          .map((c: any) => c.text || '')
                          .join('');
                  // Attach result onto the matching tool call buffered above
                  const matchingTool = toolCallsThisTurn.find(
                    (t) => !t.toolCall?.result
                  );
                  if (matchingTool && matchingTool.toolCall) {
                    matchingTool.toolCall.result = resultText.slice(0, 4000); // cap stored size
                    matchingTool.toolCall.isError = block.is_error === true;
                  }
                  send('tool_result', {
                    tool_use_id: block.tool_use_id,
                    isError: block.is_error === true,
                    text: resultText.slice(0, 4000),
                  });
                }
              }
              break;
            }
            case 'result': {
              const result = sdkMessage as any;
              if (typeof result.result === 'string' && result.result.trim()) {
                resultSummary = result.result;
              }
              send('result', {
                isError: result.is_error,
                summary: result.result,
                durationMs: result.duration_ms,
                turns: result.num_turns,
                costUsd: result.total_cost_usd,
              });
              if (typeof result.total_cost_usd === 'number') {
                thread.totalCostUsd = (thread.totalCostUsd || 0) + result.total_cost_usd;
              }
              break;
            }
          }
        }

        // Fallback: if the SDK never streamed any assistant text but the
        // result message has a final answer, surface it now so the user
        // always sees a reply.
        if (assistantTextBuffer.length === 0 && resultSummary) {
          console.log(
            `[chat] no streamed text — falling back to result.result (${resultSummary.length} chars)`
          );
          assistantTextBuffer.push(resultSummary);
          send('text', { text: resultSummary });
        }
        console.log(
          `[chat] turn complete. types=${[...seenMessageTypes].join(',')} text=${assistantTextBuffer.join(
            ''
          ).length}ch tools=${toolCallsThisTurn.length}`
        );

        // Snapshot the assistant turn into the persisted thread
        const assistantText = assistantTextBuffer.join('').trim();
        if (assistantText || toolCallsThisTurn.length > 0) {
          // Interleave tool calls + final text in chronological order;
          // for v1 we put tool calls first, then text, since text often comes last.
          for (const toolMsg of toolCallsThisTurn) {
            thread.messages.push(toolMsg);
          }
          if (assistantText) {
            thread.messages.push({
              id: crypto.randomUUID(),
              role: 'assistant',
              text: assistantText,
              createdAt: new Date().toISOString(),
            });
          }
        }

        send('status', { phase: 'persisting', message: 'Saving thread...' });
        try {
          await saveThread(thread);
          send('saved', { id: thread.id, title: thread.title });
        } catch (e) {
          send('error', { message: `Failed to persist thread: ${(e as Error).message}` });
        }

        send('done', { id: thread.id });
      } catch (err) {
        send('error', { message: (err as Error).message });
      } finally {
        if (workspaceCwd) {
          await cleanupWorkspace(workspaceCwd);
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
