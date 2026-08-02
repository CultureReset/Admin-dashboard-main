/**
 * Concierge test harness.
 *
 * POST /api/tourist/ai-chat?as_tourist=<user_id>
 *
 * Lets an admin ask the concierge a question while impersonating a specific
 * tourist, so recommendations reflect that person's saved preferences.
 */

import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, EmptyState, Notice, PageHeader } from '../../ui/primitives.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import '../ai/AiChat.css';

export default function ConciergeTest() {
  const toast = useToast();
  const [asTourist, setAsTourist] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  const touristsQuery = useAsync(
    async () => unwrapList(await api.get(endpoints.tourists.list()), ['tourists']),
    [],
    { initialData: [] },
  );

  const tourists = touristsQuery.data || [];

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
      const response = await api.post(
        endpoints.tripswipe.conciergeChat(),
        { message: text },
        { query: asTourist ? { as_tourist: asTourist } : undefined },
      );
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: response?.reply || response?.answer || JSON.stringify(response, null, 2),
          suggestions: response?.suggestions || response?.entities || [],
        },
      ]);
    } catch (err) {
      toast.error(err);
      setMessages((prev) => [...prev, { role: 'error', text: err.message, path: err.path }]);
    } finally {
      setBusy(false);
    }
  };

  const selected = tourists.find((t) => (t.user_id || t.id) === asTourist);

  return (
    <>
      <PageHeader
        title="Concierge test"
        description="Ask the tourist-facing concierge a question, optionally as a specific user."
        actions={
          messages.length > 0 && <Button onClick={() => setMessages([])}>Clear</Button>
        }
      />

      <Card title="Impersonate" subtitle="Leave blank to ask as an anonymous visitor.">
        <select
          className="ui-input ui-input--select"
          style={{ maxWidth: 420 }}
          value={asTourist}
          onChange={(e) => setAsTourist(e.target.value)}
        >
          <option value="">— anonymous —</option>
          {tourists.map((tourist) => {
            const id = tourist.user_id || tourist.id;
            return (
              <option key={id} value={id}>
                {tourist.name || tourist.email || id}
              </option>
            );
          })}
        </select>
        {selected && (
          <>
            <div style={{ height: 'var(--space-3)' }} />
            <Notice tone="info">
              Answers will reflect {selected.name || selected.email}&apos;s saved places and preferences.
            </Notice>
          </>
        )}
      </Card>

      <div style={{ height: 'var(--space-4)' }} />

      <Card padded={false}>
        <div className="chat">
          <div className="chat__log">
            {messages.length === 0 && (
              <EmptyState
                icon="🧪"
                title="No messages yet"
                description="Try “what should I do tonight with kids?”"
              />
            )}
            {messages.map((message, index) => (
              <div className={`chat__msg chat__msg--${message.role}`} key={index}>
                <div className="chat__bubble">
                  {message.text}
                  {message.path && <div className="chat__path mono">{message.path}</div>}
                  {message.suggestions?.length > 0 && (
                    <div className="chat__sources">
                      {message.suggestions.slice(0, 8).map((suggestion, i) => (
                        <Badge key={i} tone="info">
                          {typeof suggestion === 'string'
                            ? suggestion
                            : suggestion.name || suggestion.slug}
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
              placeholder="Ask the concierge…"
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
