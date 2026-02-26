import { NextRequest, NextResponse } from 'next/server';

const ERPAI_BASE = process.env.ERPAI_BASE_URL || 'https://make-api.erpai.dev/api';
const DEFAULT_APP_ID = '69957a3c9cf5cf00139a7aa7';

function getConfig() {
  const token = process.env.ERPAI_TOKEN;
  const appId = process.env.ERPAI_APP_ID || DEFAULT_APP_ID;
  return { token, appId };
}

const erpaiHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

// Step 1: Generate SQL from natural language
async function generateSQL(prompt: string, token: string, appId: string) {
  const url = `${ERPAI_BASE}/v1/agent/app/sql/generate?appId=${appId}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: erpaiHeaders(token),
    body: JSON.stringify({ appId, prompt: prompt.trim() }),
  });

  if (!response.ok) {
    const text = await response.text();
    let data: Record<string, unknown> | null = null;
    try { data = JSON.parse(text); } catch { /* not JSON */ }
    const msg = data?.message ? String(data.message) : `SQL generation failed (${response.status})`;
    throw new Error(msg);
  }

  const data = await response.json();
  // Response shape: { status, message, success, response: { content: { sqlQuery: "..." } } }
  const sqlQuery = data?.response?.content?.sqlQuery;
  if (!sqlQuery) {
    // Sometimes the response has a text answer instead of SQL
    const textAnswer = data?.response?.content?.text;
    if (textAnswer) {
      return { type: 'text' as const, answer: textAnswer, sql: null };
    }
    throw new Error('No SQL query generated');
  }

  return { type: 'sql' as const, sql: sqlQuery, answer: null };
}

// Step 2: Execute SQL query
async function executeSQL(sqlQuery: string, token: string, appId: string) {
  const url = `${ERPAI_BASE}/v1/agent/app/sql/execute?appId=${appId}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: erpaiHeaders(token),
    body: JSON.stringify({ appId, sqlQuery }),
  });

  if (!response.ok) {
    const text = await response.text();
    let data: Record<string, unknown> | null = null;
    try { data = JSON.parse(text); } catch { /* not JSON */ }
    const msg = data?.message ? String(data.message) : `SQL execution failed (${response.status})`;
    throw new Error(msg);
  }

  const data = await response.json();
  // Response shape: { status, success, data: { rows: [...], fields: [...], rowCount: N } }
  return data?.data || data;
}

// Format result rows into a human-readable answer
function formatAnswer(rows: Record<string, unknown>[], rowCount: number): string {
  if (!rows || rows.length === 0) return 'No results found.';

  // Single value result (e.g., COUNT, SUM)
  if (rows.length === 1) {
    const keys = Object.keys(rows[0]);
    if (keys.length === 1) {
      const val = rows[0][keys[0]];
      const label = keys[0].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return `**${label}:** ${val}`;
    }
    // Single row, multiple columns — format as key-value pairs
    if (keys.length <= 6) {
      return keys.map(k => {
        const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return `**${label}:** ${rows[0][k] ?? '—'}`;
      }).join('\n');
    }
  }

  // Multiple rows
  return `Found **${rowCount}** result${rowCount !== 1 ? 's' : ''}:`;
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
      try {
        const genResult = await generateSQL(message, token, appId);
        if (genResult.type === 'text') {
          return NextResponse.json({ answer: genResult.answer });
        }
        const execResult = await executeSQL(genResult.sql!, token, appId);
        return NextResponse.json({ sql: genResult.sql, ...execResult });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
      }
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

          // 2. Generate SQL
          const genResult = await generateSQL(message, token, appId);

          // If the model returned a text answer (no SQL needed)
          if (genResult.type === 'text') {
            const answerText = genResult.answer || 'No results.';
            // Stream answer text with typewriter effect
            const chunks = chunkText(answerText);
            for (const chunk of chunks) {
              send({ type: 'text_delta', content: chunk });
              await new Promise(r => setTimeout(r, 15 + Math.random() * 10));
            }
            send({ type: 'done' });
            return;
          }

          const sql = genResult.sql!;

          // 3. Show the SQL tool call
          send({ type: 'tool_start', tool: 'execute_sql', content: sql });

          // 4. Execute SQL
          let execResult;
          try {
            execResult = await executeSQL(sql, token, appId);
          } catch (execErr: unknown) {
            const execMsg = execErr instanceof Error ? execErr.message : 'SQL execution failed';
            send({ type: 'tool_end', tool: 'execute_sql', content: `Query failed: ${execMsg}`, rows: 0 });
            send({ type: 'text_delta', content: `I generated a SQL query but it failed to execute: **${execMsg}**\n\nThis usually means the AI picked incorrect column names. Try rephrasing your question.` });
            send({ type: 'done' });
            return;
          }

          const rows = Array.isArray(execResult?.rows) ? execResult.rows : [];
          const rowCount = execResult?.rowCount ?? rows.length;

          send({ type: 'tool_end', tool: 'execute_sql', content: `Query executed — ${rowCount} row${rowCount !== 1 ? 's' : ''} returned`, rows: rowCount });

          // 5. Format and stream the answer
          const answerText = formatAnswer(rows, rowCount);
          const chunks = chunkText(answerText);
          for (const chunk of chunks) {
            send({ type: 'text_delta', content: chunk });
            await new Promise(r => setTimeout(r, 15 + Math.random() * 10));
          }

          // 6. Send data table for multi-row results
          if (rows.length > 1) {
            // Clean up rows: remove internal fields, limit columns
            const cleanRows = rows.slice(0, 50).map((row: Record<string, unknown>) => {
              const clean: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(row)) {
                // Skip internal fields
                if (k === '_id' || k.endsWith('_id') || k === 'draft' || k === 'sequence_format_id') continue;
                if (k.startsWith('rec_') || k.startsWith('related_')) continue;
                clean[k] = v;
              }
              return clean;
            });

            if (Object.keys(cleanRows[0] || {}).length > 0) {
              send({ type: 'data_table', content: cleanRows, total: rowCount });
            }
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

// Split text into small chunks for typewriter effect
function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    const size = Math.min(3 + Math.floor(Math.random() * 5), remaining.length);
    chunks.push(remaining.slice(0, size));
    remaining = remaining.slice(size);
  }
  return chunks;
}
