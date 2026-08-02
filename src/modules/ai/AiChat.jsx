/**
 * AI chat against the GCR knowledge base.
 *
 * POST /api/admin/gcr/ask  { question } → { answer, sources }
 *
 * Note: the legacy dashboard also called /api/admin/ai-chat-history to persist
 * transcripts. That route does not exist in gcr-api-clean, so history here is
 * kept in the browser session only — and the UI says so rather than implying
 * conversations are saved server-side.
 */

import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, EmptyState, Notice, PageHeader } from '../../ui/primitives.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import './AiChat.css';

export default function AiChat() {
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const ask = async (event) => {
    event?.preventDefault();
    const text = question.trim();
    if (!text || busy) return;

    setMessages((prev) => [...prev, { role: 'user', text }]);
    setQuestion('');
    setBusy(true);

    try {
      const response = await api.post(endpoints.ai.ask(), { question: text });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: response?.answer || 'The API returned no answer.',
          sources: response?.sources || [],
        },
      ]);
    } catch (err) {
      toast.error(err);
      setMessages((prev) => [
        ...prev,
        { role: 'error', text: err.message, path: err.path },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="AI chat"
        description="Ask the GCR knowledge base a question."
        actions={
          messages.length > 0 && (
            <Button onClick={() => setMessages([])}>Clear conversation</Button>
          )
        }
      />

      <Notice tone="info" title="This conversation is not saved">
        Transcripts stay in this browser tab. The API has no chat-history route, so nothing is
        written server-side.
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <Card padded={false}>
        <div className="chat">
          <div className="chat__log">
            {messages.length === 0 && (
              <EmptyState
                icon="✨"
                title="Ask something"
                description="Try “which restaurants have live music on Friday?”"
              />
            )}

            {messages.map((message, index) => (
              <div className={`chat__msg chat__msg--${message.role}`} key={index}>
                <div className="chat__bubble">
                  {message.text}
                  {message.path && <div className="chat__path mono">{message.path}</div>}
                  {message.sources?.length > 0 && (
                    <div className="chat__sources">
                      {message.sources.map((source, sourceIndex) => (
                        <Badge key={sourceIndex} tone="info">
                          {typeof source === 'string' ? source : source.name || source.slug}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {busy && (
              <div className="chat__msg chat__msg--assistant">
                <div className="chat__bubble chat__bubble--thinking">Thinking…</div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          <form className="chat__composer" onSubmit={ask}>
            <input
              className="ui-input"
              value={question}
              placeholder="Ask about businesses, events, menus…"
              disabled={busy}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <Button type="submit" variant="primary" loading={busy} disabled={!question.trim()}>
              Send
            </Button>
          </form>
        </div>
      </Card>
    </>
  );
}
