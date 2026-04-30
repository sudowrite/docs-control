/**
 * Chat stream — runs one streaming turn against an existing thread and emits
 * SSE events as the agent thinks, calls tools, and replies.
 *
 * Backed by the bare Anthropic SDK + custom tool-use loop in lib/agent-runtime.
 * Most turns are pure chat (zero tool calls); tools and subagents fire when
 * the model decides it needs them.
 *
 * SSE event names match what the existing client (use-chat-stream.ts) already
 * consumes — no UI changes needed here.
 */

import { NextRequest } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { auth } from '@/lib/auth';
import {
  loadThread,
  saveThread,
  newThread,
  generateThreadTitle,
  type ChatThread,
  type ChatMessage,
} from '@/lib/chat-threads';
import { buildRuntime, runChatTurn } from '@/lib/agent-runtime';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function sseEvent(event: string, payload: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

/**
 * Convert the persisted thread message log into the Anthropic API's expected
 * MessageParam shape. We only forward user + assistant turns; tool messages
 * are summarized as text in the assistant turn so the model has continuity
 * without rehydrating opaque tool_use blocks across requests.
 */
function buildHistory(thread: ChatThread): Anthropic.Messages.MessageParam[] {
  const out: Anthropic.Messages.MessageParam[] = [];
  for (const msg of thread.messages) {
    if (msg.role === 'user') {
      out.push({ role: 'user', content: msg.text });
    } else if (msg.role === 'assistant' && msg.text.trim()) {
      out.push({ role: 'assistant', content: msg.text });
    }
    // Tool messages are dropped from history — they were already incorporated
    // into the assistant's reply when the turn ran.
  }
  return out;
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
    if (!loaded) thread.id = body.threadId;
  } else {
    thread = newThread(userEmail);
  }

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

      try {
        send('thread', { id: thread.id, title: thread.title });
        send('user_message', userMessage);
        send('status', { phase: 'thinking', message: 'Loading repo...' });

        // Build runtime — emit hooks plug into our SSE stream
        const rt = await buildRuntime({
          text: (text) => send('text', { text }),
          toolStart: (call) =>
            send('tool_call', { id: call.id, name: call.name, input: call.input }),
          toolResult: (result) =>
            send('tool_result', {
              tool_use_id: result.id,
              text: result.text.slice(0, 4000),
              isError: result.isError,
            }),
          status: (message) => send('status', { phase: 'thinking', message }),
        });

        send('agent_init', {
          articleCount: rt.articles.size,
        });
        send('status', { phase: 'thinking', message: '' });

        const history = buildHistory(thread);
        const turnResult = await runChatTurn(rt, history, body.message);

        // Snapshot the assistant turn into the persisted thread
        // Tool call cards: persisted as 'tool' role messages
        for (const tc of turnResult.toolCalls) {
          thread.messages.push({
            id: tc.id,
            role: 'tool',
            text: tc.name,
            toolCall: {
              name: tc.name,
              input: tc.input,
              result: tc.result.slice(0, 4000),
              isError: tc.isError,
            },
            createdAt: new Date().toISOString(),
          });
        }
        if (turnResult.text) {
          thread.messages.push({
            id: crypto.randomUUID(),
            role: 'assistant',
            text: turnResult.text,
            createdAt: new Date().toISOString(),
          });
        }

        send('result', {
          isError: false,
          summary: turnResult.text,
          toolCallCount: turnResult.toolCalls.length,
          committed: turnResult.committed,
        });

        send('status', { phase: 'persisting', message: 'Saving thread...' });
        try {
          await saveThread(thread);
          send('saved', { id: thread.id, title: thread.title });
        } catch (e) {
          send('error', { message: `Failed to persist thread: ${(e as Error).message}` });
        }

        send('done', { id: thread.id });
      } catch (err) {
        console.error('[chat] turn failed:', err);
        send('error', { message: (err as Error).message });
      } finally {
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
