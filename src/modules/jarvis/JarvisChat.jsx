/**
 * Jarvis chat panel.
 *
 * Talks to /api/jarvis/chat on this dashboard (api/jarvis/chat.js), which
 * checks the admin session and forwards to Jarvis' OpenAI-compatible
 * /v1/chat/completions with the server-side key. No Jarvis key or address is
 * in this bundle. Streaming (SSE) is used so long answers appear as they come.
 * History is kept in this browser tab only.
 */

import { useEffect, useRef, useState } from 'react';
import { Button, Card, EmptyState, Notice, PageHeader } from '../../ui/primitives.jsx';
import { tokenStore } from '../../auth/tokenStore.js';
import '../ai/AiChat.css';

const STORE_KEY = 'jarvis_chat_v1';

function loadHistory() {
  try { return JSON.parse(sessionStorage.getItem(STORE_KEY)) || []; } catch { return []; }
}

export default function JarvisChat() {
  const [messages, setMessages] = useState(loadHistory);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(messages));
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const send = async (event) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const history = [...messages, { role: 'user', content: text }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setError('');
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/jarvis/chat', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${tokenStore.get() || ''}`,
        },
        body: JSON.stringify({ messages: history, stream: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.error?.message || `Jarvis answered ${res.status}`);
      }
      const append = (chunk) => setMessages((prev) => {
        const next = prev.slice();
        next[next.length - 1] = { role: 'assistant', content: next[next.length - 1].content + chunk };
        return next;
      });

      if (!(res.headers.get('content-type') || '').includes('text/event-stream')) {
        const data = await res.json();
        append(data?.choices?.[0]?.message?.content || '');
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          const data = line.replace(/^data:\s?/, '').trim();
          if (!line.startsWith('data:') || !data || data === '[DONE]') continue;
          try {
            const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
            if (delta) append(delta);
          } catch { /* partial or keep-alive line */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || 'Jarvis did not answer');
      setMessages((prev) => (prev[prev.length - 1]?.content ? prev : prev.slice(0, -1)));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  return (
    <div>
      <PageHeader
        title="Jarvis"
        description="Chat with Jarvis on the Droplet. Proxied server-side; the key never reaches the browser."
        actions={
          <Button onClick={() => setMessages([])} disabled={busy || !messages.length}>New chat</Button>
        }
      />
      {error && <Notice tone="danger" title="Jarvis error">{error}</Notice>}
      <Card>
        <div className="chat__log">
          {!messages.length && <EmptyState icon="🤖" title="Ask Jarvis anything" description="History stays in this tab only." />}
          {messages.map((m, i) => (
            <div key={i} className={`chat__msg${m.role === "user" ? " chat__msg--user" : ""}`}>
              <div className="chat__bubble" style={{ whiteSpace: "pre-wrap" }}>{m.content || (busy && i === messages.length - 1 ? '…' : '')}</div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <form onSubmit={send} className="chat__composer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e); }}
            placeholder="Message Jarvis (Enter to send, Shift+Enter for a new line)"
            rows={2}
            style={{ flex: 1 }}
          />
          {busy
            ? <Button type="button" onClick={() => abortRef.current?.abort()}>Stop</Button>
            : <Button type="submit" variant="primary" disabled={!input.trim()}>Send</Button>}
        </form>
      </Card>
    </div>
  );
}
