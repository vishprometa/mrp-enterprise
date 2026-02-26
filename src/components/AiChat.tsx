'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

/* ─── Types ─────────────────────────────────── */

interface ContentBlock {
  id: string;
  type: 'text' | 'thinking' | 'tool_start' | 'tool_end' | 'data_table' | 'error' | 'chart';
  content: string;
  tool?: string;
  rows?: number;
  total?: number;
  data?: Record<string, unknown>[];
  status?: 'running' | 'complete';
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  blocks: ContentBlock[];
  timestamp: number;
  isStreaming?: boolean;
}

interface AiChatProps {
  open: boolean;
  onClose: () => void;
}

/* ─── Helpers ───────────────────────────────── */

let _blockId = 0;
const uid = () => `b-${Date.now()}-${++_blockId}`;
const msgId = () => `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const SUGGESTIONS = [
  { icon: '📊', text: "What's my inventory health?" },
  { icon: '🏭', text: 'Show production bottlenecks' },
  { icon: '📦', text: 'Summarize open purchase orders' },
  { icon: '🔄', text: 'Which items need reordering?' },
  { icon: '📈', text: 'Revenue by customer this quarter' },
  { icon: '⚠️', text: 'Show quality inspection failures' },
];

/* ─── Markdown Renderer ─────────────────────── */

function renderMarkdown(text: string): string {
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="ai-code-block"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Headers
    .replace(/^### (.+)$/gm, '<h4 class="ai-md-h4">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="ai-md-h3">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="ai-md-h2">$1</h2>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="ai-link">$1</a>')
    // Bullet lists
    .replace(/^[*-] (.+)$/gm, '<li>$1</li>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*?<\/li>(\s*<br\/>)?)+/g, (match) => {
    return '<ul class="ai-md-list">' + match.replace(/<br\/>/g, '') + '</ul>';
  });

  return `<p>${html}</p>`;
}

/* ─── ToolBlock Component ───────────────────── */

function ToolBlock({ block }: { block: ContentBlock }) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = block.type === 'tool_start';
  const icon = isRunning ? '⟳' : '✓';
  const label = block.tool === 'execute_sql' ? 'SQL Query' : (block.tool || 'Tool');

  return (
    <div className={`ai-tool-block ${isRunning ? 'running' : 'complete'}`}>
      <button className="ai-tool-header" onClick={() => setExpanded(!expanded)}>
        <span className={`ai-tool-icon ${isRunning ? 'spinning' : ''}`}>{icon}</span>
        <span className="ai-tool-label">{label}</span>
        {block.rows !== undefined && <span className="ai-tool-meta">{block.rows} rows</span>}
        <svg className={`ai-tool-chevron ${expanded ? 'open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {expanded && block.content && (
        <div className="ai-tool-body">
          <pre className="ai-tool-sql">{block.content}</pre>
        </div>
      )}
    </div>
  );
}

/* ─── DataTable Component ───────────────────── */

function DataTable({ data, total }: { data: Record<string, unknown>[]; total?: number }) {
  const [expanded, setExpanded] = useState(false);
  if (!data || data.length === 0) return null;

  const keys = Object.keys(data[0]);
  const displayData = expanded ? data : data.slice(0, 5);

  return (
    <div className="ai-data-table-wrapper">
      <div className="ai-data-table-scroll">
        <table className="ai-data-table">
          <thead>
            <tr>
              {keys.map((k) => (
                <th key={k}>{k.replace(/_/g, ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, i) => (
              <tr key={i}>
                {keys.map((k) => (
                  <td key={k}>{formatCell(row[k])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > 5 && (
        <button className="ai-data-table-toggle" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show less' : `Show all ${total || data.length} rows`}
        </button>
      )}
    </div>
  );
}

function formatCell(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') return val.toLocaleString();
  if (typeof val === 'boolean') return val ? '✓' : '✗';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

/* ─── ThinkingIndicator ─────────────────────── */

function ThinkingIndicator() {
  return (
    <div className="ai-thinking-block">
      <div className="ai-thinking-shimmer" />
      <span className="ai-thinking-text">Analyzing your question...</span>
    </div>
  );
}

/* ─── Main Chat Component ───────────────────── */

export default function AiChat({ open, onClose }: AiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const userScrolledRef = useRef(false);
  const pathname = usePathname();

  // Auto-scroll unless user scrolled up
  const scrollToBottom = useCallback(() => {
    if (!userScrolledRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Detect user scroll
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      userScrolledRef.current = scrollHeight - scrollTop - clientHeight > 80;
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 300);
  }, [open]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = '24px';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [input]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    abortController?.abort();
    setIsStreaming(false);
    setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
  }, [abortController]);

  // Send message with SSE streaming
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: ChatMessage = {
      id: msgId(),
      role: 'user',
      content: trimmed,
      blocks: [],
      timestamp: Date.now(),
    };

    const assistantMsg: ChatMessage = {
      id: msgId(),
      role: 'assistant',
      content: '',
      blocks: [],
      timestamp: Date.now(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);
    userScrolledRef.current = false;

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, stream: true }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      const blocks: ContentBlock[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          let event: Record<string, unknown>;
          try { event = JSON.parse(jsonStr); } catch { continue; }

          const type = event.type as string;

          switch (type) {
            case 'thinking': {
              blocks.push({ id: uid(), type: 'thinking', content: String(event.content || ''), status: 'running' });
              break;
            }
            case 'tool_start': {
              // Remove thinking block when tool starts
              const thinkIdx = blocks.findIndex(b => b.type === 'thinking');
              if (thinkIdx !== -1) blocks.splice(thinkIdx, 1);
              blocks.push({ id: uid(), type: 'tool_start', content: String(event.content || ''), tool: String(event.tool || ''), status: 'running' });
              break;
            }
            case 'tool_end': {
              // Replace tool_start with tool_end
              const startIdx = blocks.findIndex(b => b.type === 'tool_start' && b.tool === event.tool);
              if (startIdx !== -1) {
                blocks[startIdx] = { ...blocks[startIdx], type: 'tool_end', content: String(event.content || ''), rows: event.rows as number, status: 'complete' };
              } else {
                blocks.push({ id: uid(), type: 'tool_end', content: String(event.content || ''), tool: String(event.tool || ''), rows: event.rows as number, status: 'complete' });
              }
              break;
            }
            case 'text_delta': {
              // Remove thinking block on first text
              const thinkIdx2 = blocks.findIndex(b => b.type === 'thinking');
              if (thinkIdx2 !== -1) blocks.splice(thinkIdx2, 1);

              accumulatedText += String(event.content || '');
              const textBlock = blocks.find(b => b.type === 'text');
              if (textBlock) {
                textBlock.content = accumulatedText;
              } else {
                blocks.push({ id: uid(), type: 'text', content: accumulatedText });
              }
              break;
            }
            case 'data_table': {
              blocks.push({
                id: uid(),
                type: 'data_table',
                content: '',
                data: event.content as Record<string, unknown>[],
                total: event.total as number,
              });
              break;
            }
            case 'error': {
              blocks.push({ id: uid(), type: 'error', content: String(event.content || 'Unknown error') });
              break;
            }
            case 'done': {
              break;
            }
          }

          // Update messages state with new blocks
          setMessages(prev => prev.map(m =>
            m.id === assistantMsg.id
              ? { ...m, blocks: [...blocks], isStreaming: type !== 'done' }
              : m
          ));
        }
      }

      // Final update — mark streaming complete
      setMessages(prev => prev.map(m =>
        m.id === assistantMsg.id ? { ...m, blocks: [...blocks], isStreaming: false } : m
      ));
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        setMessages(prev => prev.map(m =>
          m.id === assistantMsg.id ? { ...m, isStreaming: false } : m
        ));
      } else {
        const errMsg = err instanceof Error ? err.message : 'Connection error';
        setMessages(prev => prev.map(m =>
          m.id === assistantMsg.id
            ? { ...m, blocks: [{ id: uid(), type: 'error', content: errMsg }], isStreaming: false }
            : m
        ));
      }
    } finally {
      setIsStreaming(false);
      setAbortController(null);
    }
  }, [isStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setInput('');
  };

  // Get page context label
  const pageContext = pathname === '/' ? 'Dashboard' : pathname.slice(1).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <>
      {/* Backdrop */}
      {open && <div className="ai-panel-overlay" onClick={onClose} />}

      {/* Panel */}
      <div className={`ai-panel ${open ? 'open' : ''}`}>
        {/* Header */}
        <div className="ai-panel-header">
          <div className="ai-header-left">
            <h3>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
              </svg>
              MRP AI
              <span className="ai-badge">BETA</span>
            </h3>
            <span className="ai-header-sub">Powered by ERPAI</span>
          </div>
          <div className="ai-header-actions">
            <button className="ai-header-btn" onClick={clearChat} title="New chat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button className="ai-header-btn" onClick={onClose} title="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="ai-panel-messages" ref={messagesContainerRef}>
          {/* Empty state */}
          {messages.length === 0 && !isStreaming && (
            <div className="ai-empty-state">
              <div className="ai-empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
                </svg>
              </div>
              <h4 className="ai-empty-title">Ask anything about your MRP data</h4>
              <p className="ai-empty-subtitle">
                I can query your database, analyze trends, find bottlenecks, and provide insights.
              </p>
              <div className="ai-suggestion-grid">
                {SUGGESTIONS.map((s) => (
                  <button key={s.text} className="ai-suggestion-card" onClick={() => sendMessage(s.text)}>
                    <span className="ai-suggestion-icon">{s.icon}</span>
                    <span className="ai-suggestion-text">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg) => (
            <div key={msg.id} className={`ai-msg ai-msg-${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="ai-msg-avatar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
                  </svg>
                </div>
              )}
              <div className="ai-msg-content">
                {msg.role === 'user' ? (
                  <div className="ai-msg-bubble user">{msg.content}</div>
                ) : (
                  <div className="ai-msg-blocks">
                    {msg.blocks.map((block) => {
                      switch (block.type) {
                        case 'thinking':
                          return <ThinkingIndicator key={block.id} />;
                        case 'tool_start':
                        case 'tool_end':
                          return <ToolBlock key={block.id} block={block} />;
                        case 'text':
                          return (
                            <div key={block.id} className="ai-msg-text">
                              <div className="ai-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(block.content) }} />
                              {msg.isStreaming && <span className="ai-cursor" />}
                            </div>
                          );
                        case 'data_table':
                          return <DataTable key={block.id} data={block.data || []} total={block.total} />;
                        case 'error':
                          return (
                            <div key={block.id} className="ai-error-block">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                              {block.content}
                            </div>
                          );
                        default:
                          return null;
                      }
                    })}
                    {msg.isStreaming && msg.blocks.length === 0 && <ThinkingIndicator />}
                  </div>
                )}
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Stop button */}
        {isStreaming && (
          <div className="ai-stop-bar">
            <button className="ai-stop-btn" onClick={stopStreaming}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
              Stop generating
            </button>
          </div>
        )}

        {/* Input area */}
        <div className="ai-panel-input-area">
          <div className="ai-context-bar">
            <span className="ai-context-chip">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
              {pageContext}
            </span>
          </div>
          <div className="ai-input-row">
            <textarea
              ref={textareaRef}
              className="ai-textarea"
              placeholder="Ask about your data..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              rows={1}
            />
            <button
              className={`ai-send-btn ${input.trim() && !isStreaming ? 'active' : ''}`}
              onClick={() => sendMessage(input)}
              disabled={isStreaming || !input.trim()}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <div className="ai-input-hint">
            <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> new line
          </div>
        </div>
      </div>
    </>
  );
}
