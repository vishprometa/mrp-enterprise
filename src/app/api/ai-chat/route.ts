import { NextRequest, NextResponse } from 'next/server';

const ERPAI_BASE = 'https://make-api.erpai.dev/api/v1/app-builder';
const DEFAULT_APP_ID = '69957a3c9cf5cf00139a7aa7';

function getConfig() {
  const token = process.env.ERPAI_TOKEN;
  const appId = process.env.ERPAI_APP_ID || DEFAULT_APP_ID;
  return { token, appId };
}

async function callDataQna(message: string, token: string, appId: string) {
  const response = await fetch(`${ERPAI_BASE}/data-qna`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-app-id': appId,
    },
    body: JSON.stringify({ appId, todo: message.trim() }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData: Record<string, unknown> | null = null;
    try { errorData = JSON.parse(errorText); } catch { /* not JSON */ }
    const msg = errorData && typeof errorData === 'object' && 'message' in errorData
      ? String((errorData as { message: string }).message)
      : `ERPAI API error (${response.status})`;
    throw new Error(msg);
  }

  return response.json();
}

// Streaming SSE endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, stream } = body as { message?: string; stream?: boolean };

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const { token, appId } = getConfig();
    if (!token) {
      return NextResponse.json({ error: 'Server configuration error: missing ERPAI_TOKEN' }, { status: 500 });
    }

    // Non-streaming mode (legacy)
    if (!stream) {
      const data = await callDataQna(message, token, appId);
      return NextResponse.json(data);
    }

    // Streaming SSE mode
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        const send = (event: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        try {
          // 1. Thinking phase
          send({ type: 'thinking', content: 'Analyzing your question...' });

          // 2. Call the data-qna API
          const data = await callDataQna(message, token, appId);

          // Extract fields from response
          const result = data?.data || data;
          const sql = result?.sql || result?.query;
          const answer = result?.answer || result?.result;
          const tableData = result?.tableData || result?.rows || result?.data;
          const chartConfig = result?.chartConfig || result?.chart;

          // 3. Show tool call if SQL was generated
          if (sql) {
            send({ type: 'tool_start', tool: 'execute_sql', content: typeof sql === 'string' ? sql : JSON.stringify(sql) });

            // Simulate brief processing delay for visual effect
            await new Promise(r => setTimeout(r, 300));

            const rowCount = Array.isArray(tableData) ? tableData.length :
                            Array.isArray(answer) ? (typeof answer[0] === 'object' ? answer.length : 0) : 0;
            send({ type: 'tool_end', tool: 'execute_sql', content: `Query executed — ${rowCount} row${rowCount !== 1 ? 's' : ''} returned`, rows: rowCount });
          }

          // 4. Stream the answer text
          let answerText = '';
          if (typeof answer === 'string') {
            answerText = answer;
          } else if (Array.isArray(answer) && answer.length > 0 && typeof answer[0] === 'object') {
            // Answer is tabular data — format as text summary
            answerText = `Found ${answer.length} result${answer.length !== 1 ? 's' : ''}:`;
          } else if (answer) {
            answerText = typeof answer === 'object' ? JSON.stringify(answer, null, 2) : String(answer);
          }

          // Also check for direct string results
          if (!answerText && typeof result === 'string') {
            answerText = result;
          }
          if (!answerText && result?.message) {
            answerText = String(result.message);
          }

          // Stream answer in small chunks for typewriter effect
          if (answerText) {
            // Split into natural chunks (sentences, words, or fixed size)
            const chunks: string[] = [];
            let remaining = answerText;
            while (remaining.length > 0) {
              const size = Math.min(3 + Math.floor(Math.random() * 5), remaining.length);
              chunks.push(remaining.slice(0, size));
              remaining = remaining.slice(size);
            }

            for (const chunk of chunks) {
              send({ type: 'text_delta', content: chunk });
              await new Promise(r => setTimeout(r, 15 + Math.random() * 10));
            }
          }

          // 5. Stream data table if present
          let dataRows = null;
          if (Array.isArray(tableData) && tableData.length > 0) {
            dataRows = tableData;
          } else if (Array.isArray(answer) && answer.length > 0 && typeof answer[0] === 'object') {
            dataRows = answer;
          }

          if (dataRows && dataRows.length > 0) {
            // Limit to 50 rows for UI performance
            const limited = dataRows.slice(0, 50);
            send({ type: 'data_table', content: limited, total: dataRows.length });
          }

          // 6. Chart config if present
          if (chartConfig) {
            send({ type: 'chart', content: chartConfig });
          }

          // 7. Done
          send({ type: 'done' });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          send({ type: 'error', content: errMsg });
        } finally {
          controller.close();
        }
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
