import { NextRequest, NextResponse } from 'next/server';
import WebSocket from 'ws';

/* ─── Vercel Config ──────────────────────────────────────────────── */
export const maxDuration = 120; // Allow up to 2 minutes for agent responses
export const dynamic = 'force-dynamic';

/* ─── Config ─────────────────────────────────────────────────────── */

const ERPAI_BASE = process.env.ERPAI_BASE_URL || 'https://make-api.erpai.dev/api';
const ERPAI_WS = (process.env.ERPAI_WS_URL || `${ERPAI_BASE}/v1/agent/openep/ws`).replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
const DEFAULT_APP_ID = '69957a3c9cf5cf00139a7aa7';
const AGENT_TIMEOUT_MS = 120_000; // 2 minutes max

function getConfig() {
  const token = process.env.ERPAI_TOKEN;
  const appId = process.env.ERPAI_APP_ID || DEFAULT_APP_ID;
  return { token, appId };
}

function generateId(): string {
  // Simple ObjectId-like hex string
  const ts = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const rand = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return ts + rand;
}

/* ─── SSE Streaming Endpoint ─────────────────────────────────────── */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, threadId: existingThreadId } = body as {
      message?: string;
      threadId?: string;
    };

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const { token, appId } = getConfig();
    if (!token) {
      return NextResponse.json({ error: 'Server configuration error: missing ERPAI_TOKEN' }, { status: 500 });
    }

    const threadId = existingThreadId || generateId();
    const sessionId = generateId();
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      start(controller) {
        let wsCleanedUp = false;
        let ws: WebSocket | null = null;
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

        const send = (event: Record<string, unknown>) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            // Controller might be closed
          }
        };

        const cleanup = () => {
          if (wsCleanedUp) return;
          wsCleanedUp = true;
          if (timeoutHandle) clearTimeout(timeoutHandle);
          if (ws && ws.readyState !== WebSocket.CLOSED) {
            try { ws.close(1000); } catch { /* ignore */ }
          }
          try { controller.close(); } catch { /* ignore */ }
        };

        // Safety timeout
        timeoutHandle = setTimeout(() => {
          send({ type: 'error', content: 'Request timed out after 2 minutes' });
          send({ type: 'done', threadId });
          cleanup();
        }, AGENT_TIMEOUT_MS);

        // 1. Send initial thinking state
        send({ type: 'status', threadId, content: 'Connecting to AI agent...' });
        send({ type: 'thinking', content: 'Analyzing your question...' });

        // 2. Connect WebSocket
        try {
          ws = new WebSocket(ERPAI_WS);
        } catch (err) {
          send({ type: 'error', content: `WebSocket connection failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
          send({ type: 'done', threadId });
          cleanup();
          return;
        }

        ws.on('open', () => {
          // 3. Authenticate
          ws!.send(JSON.stringify({
            eventType: 'new-connection',
            message: {
              token,
              threadId,
            },
          }));
        });

        ws.on('message', async (raw: WebSocket.Data) => {
          try {
            const data = JSON.parse(raw.toString());

            // Handle pong
            if (data.eventType === '_pong_') return;

            // Handle auth success → fire the agent message
            if (data.eventType === 'new-connection-success') {
              // 4. POST to agent-message endpoint
              try {
                const agentUrl = `${ERPAI_BASE}/v1/agent/app/agent-message?appId=${appId}`;
                const agentRes = await fetch(agentUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    content: message.trim(),
                    threadId,
                    appId,
                    action: 'ASK',
                    chatType: 'APP',
                    sessionId,
                  }),
                });

                if (!agentRes.ok) {
                  const errText = await agentRes.text();
                  let errMsg = `Agent API error (${agentRes.status})`;
                  try {
                    const errData = JSON.parse(errText);
                    if (errData.message) errMsg = errData.message;
                  } catch { /* not JSON */ }
                  send({ type: 'error', content: errMsg });
                  send({ type: 'done', threadId });
                  cleanup();
                }
              } catch (err) {
                send({ type: 'error', content: `Failed to send message: ${err instanceof Error ? err.message : 'Unknown error'}` });
                send({ type: 'done', threadId });
                cleanup();
              }
              return;
            }

            // Handle auth error
            if (data.error) {
              send({ type: 'error', content: `Authentication failed: ${JSON.stringify(data.error)}` });
              send({ type: 'done', threadId });
              cleanup();
              return;
            }

            const eventType = data.eventType;

            // 5. Stream agent events as SSE
            switch (eventType) {
              case 'processing_start': {
                send({ type: 'thinking', content: 'AI agent is processing...' });
                break;
              }

              case 'ai_copilot_response': {
                try {
                  const msg = JSON.parse(data.message);
                  const msgType = msg?.type;

                  if (msgType === 'content_block_update' && msg.block) {
                    const block = msg.block;
                    send({
                      type: 'block',
                      block: {
                        id: block.id,
                        format: block.format,
                        content: block.content,
                        subtitle: block.subtitle,
                        metadata: block.metadata,
                      },
                    });
                  } else if (msgType === 'content_block_emission') {
                    // Handle bulk content block emissions
                    const detail = msg.detail;
                    if (detail?.contentBlocks) {
                      for (const block of detail.contentBlocks) {
                        send({
                          type: 'block',
                          block: {
                            id: block.id,
                            format: block.format,
                            content: block.content,
                            subtitle: block.subtitle,
                            metadata: block.metadata,
                          },
                        });
                      }
                    }
                  } else if (msgType === 'stream') {
                    // Legacy text stream
                    if (msg.content) {
                      send({ type: 'text_delta', content: msg.content });
                    }
                  } else if (msgType === 'done') {
                    // Agent signaled completion within content stream
                    send({ type: 'done', threadId });
                    cleanup();
                  }
                } catch {
                  // Couldn't parse message — skip
                }
                break;
              }

              case 'processing_complete': {
                // Small delay to let any final content blocks arrive
                setTimeout(() => {
                  send({ type: 'done', threadId });
                  cleanup();
                }, 500);
                break;
              }

              case 'processing_error': {
                let errMsg = 'Agent processing error';
                try {
                  const errData = JSON.parse(data.message);
                  if (errData.error) errMsg = errData.error;
                  if (errData.message) errMsg = errData.message;
                } catch { /* ignore */ }
                send({ type: 'error', content: errMsg });
                send({ type: 'done', threadId });
                cleanup();
                break;
              }

              case 'thread_title_updated': {
                try {
                  const titleData = JSON.parse(data.message);
                  if (titleData.title) {
                    send({ type: 'thread_title', content: titleData.title, threadId });
                  }
                } catch { /* ignore */ }
                break;
              }

              // Ignore other event types silently
              default:
                break;
            }
          } catch {
            // Couldn't parse WS message — skip
          }
        });

        ws.on('error', (err) => {
          send({ type: 'error', content: `Connection error: ${err.message}` });
          send({ type: 'done', threadId });
          cleanup();
        });

        ws.on('close', () => {
          // If WS closes unexpectedly before we cleaned up, signal done
          if (!wsCleanedUp) {
            send({ type: 'done', threadId });
            cleanup();
          }
        });

        // Keep-alive ping every 25 seconds
        const pingInterval = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify({ eventType: '_ping_' })); } catch { /* ignore */ }
          } else {
            clearInterval(pingInterval);
          }
        }, 25_000);

        // Clear ping on cleanup
        const origCleanup = cleanup;
        const cleanupWithPing = () => {
          clearInterval(pingInterval);
          origCleanup();
        };
        // Replace timeout and ws handlers to use cleanupWithPing
        // (The closures already capture the original cleanup, so we just need to clear the interval on close)
        ws.on('close', () => clearInterval(pingInterval));
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Internal server error: ${errMessage}` }, { status: 500 });
  }
}
