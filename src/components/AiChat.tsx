'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

const APP_ID = '69957a3c9cf5cf00139a7aa7';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "What's my inventory health?",
  'Show production bottlenecks',
  'Summarize open purchase orders',
  'Which items need reordering?',
];

interface AiChatProps {
  open: boolean;
  onClose: () => void;
}

export default function AiChat({ open, onClose }: AiChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, appId: APP_ID }),
      });

      const data = await res.json();

      let assistantContent: string;
      if (!res.ok) {
        assistantContent = data.error || 'Something went wrong. Please try again.';
      } else if (data.answer) {
        assistantContent = data.answer;
      } else if (data.result) {
        assistantContent =
          typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2);
      } else if (data.data) {
        assistantContent =
          typeof data.data === 'string' ? data.data : JSON.stringify(data.data, null, 2);
      } else {
        assistantContent = JSON.stringify(data, null, 2);
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: assistantContent }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Network error. Please check your connection and try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          zIndex: 199,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          zIndex: 200,
          backgroundColor: 'var(--bg-card)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: open ? '-8px 0 30px rgba(0,0,0,0.15)' : 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>AI Assistant</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
              Powered by ERPAI
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border)',
              borderRadius: 6,
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {messages.length === 0 && !loading && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                paddingTop: 40,
              }}
            >
              {/* Sparkle icon */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: 'var(--bg-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
                </svg>
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  lineHeight: 1.5,
                }}
              >
                Ask anything about your MRP data.
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  justifyContent: 'center',
                  marginTop: 8,
                }}
              >
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      border: '1px solid var(--border)',
                      borderRadius: 16,
                      backgroundColor: 'var(--bg-elevated)',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  backgroundColor:
                    msg.role === 'user' ? 'var(--primary)' : 'var(--bg-elevated)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text)',
                  fontSize: 13,
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '14px 14px 14px 4px',
                  backgroundColor: 'var(--bg-elevated)',
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                }}
              >
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: 'var(--text-dim)',
                      display: 'inline-block',
                      animation: `aichat-bounce 1.2s ease-in-out ${dot * 0.15}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div
          style={{
            padding: '12px 20px 16px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '4px 4px 4px 14px',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask about your data..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              style={{
                flex: 1,
                height: 34,
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text)',
                fontSize: 13,
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              style={{
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                borderRadius: 8,
                backgroundColor:
                  loading || !input.trim() ? 'var(--bg-elevated)' : 'var(--primary)',
                color: loading || !input.trim() ? 'var(--text-dim)' : '#fff',
                cursor: loading || !input.trim() ? 'default' : 'pointer',
                flexShrink: 0,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>

        {/* Bounce animation keyframes */}
        <style>{`
          @keyframes aichat-bounce {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-4px); }
          }
        `}</style>
      </div>
    </>
  );
}
