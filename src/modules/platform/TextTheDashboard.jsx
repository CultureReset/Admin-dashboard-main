/**
 * Text the dashboard.
 *
 * You send a question by SMS; a model works out which of the platform's read
 * endpoints answer it, those run for real, and it replies with what came back.
 *
 * ── The rule worth knowing ──────────────────────────────────────────────
 *
 * The model never produces a number. It chooses which query to run and phrases
 * the result — every figure in a reply came out of the database on that
 * request. Asked something no tool covers, it is required to say so rather
 * than estimate. That is the difference between an assistant and a machine
 * that confidently invents your traffic figures.
 *
 * ── Separate from the customer SMS pipeline ─────────────────────────────
 *
 * /api/sms is tourist signup, staff commands and blasts. This is /api/dashboard-sms
 * and shares no code with it.
 *
 * POST /api/dashboard-sms/ask           — try a question without a phone
 * GET/POST/PATCH/DELETE .../allowlist   — who is allowed to text
 * GET  /api/dashboard-sms/log           — every question and answer
 */

import { useState } from 'react';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { useAsync } from '../../hooks/useAsync.js';
import {
  PageHeader, Card, Badge, Button, Notice, Stat,
  LoadingBlock, ErrorState, EmptyState,
} from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useToast } from '../../ui/Toast.jsx';
import '../../ui/chips.css';
import '../engagement/charts.css';

const EXAMPLES = [
  'How many businesses do we have?',
  'How much traffic did we get this week?',
  'What are the top 5 most viewed businesses?',
  'What does Caribe Marina have on file?',
  'How many businesses have no capacity set?',
  "What's waiting in the intake queue?",
];

export default function TextTheDashboard() {
  const toast = useToast();
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [reply, setReply] = useState(null);
  const [askError, setAskError] = useState(null);
  const [newPhone, setNewPhone] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const list = useAsync(async () => api.get(endpoints.dashboardSms.allowlist()), [], { initialData: null });
  const log = useAsync(async () => api.get(endpoints.dashboardSms.log(), { query: { limit: 50 } }), [], { initialData: null });

  const ask = async (q) => {
    const text = (q ?? question).trim();
    if (!text) return;
    setAsking(true); setReply(null); setAskError(null);
    try {
      setReply(await api.post(endpoints.dashboardSms.ask(), { question: text }));
    } catch (e) {
      setAskError(e);
    } finally {
      setAsking(false);
    }
  };

  const addNumber = async () => {
    if (!newPhone.trim()) return;
    try {
      await api.post(endpoints.dashboardSms.allowlist(), { phone: newPhone.trim(), label: newLabel.trim() || undefined });
      setNewPhone(''); setNewLabel('');
      toast.success('Number added');
      list.run();
    } catch (e) {
      toast.error(e);
    }
  };

  const configured = log.data?.configured || {};
  const tools = log.data?.tools || [];

  return (
    <div>
      <PageHeader
        title="Text the dashboard"
        description="Ask a question by SMS and get an answer built from real data."
      />

      {(!configured.brevo || !configured.model) && !log.loading && (
        <>
          <Notice tone="warning" title="Not fully configured yet">
            <p>
              {!configured.model && <>The assistant needs <code>ANTHROPIC_API_KEY</code> on the API. </>}
              {!configured.brevo && <>Sending replies needs <code>BREVO_API_KEY</code>. </>}
              You can still try questions below — that path only needs the model, not the SMS provider.
            </p>
          </Notice>
          <div style={{ height: 'var(--space-4)' }} />
        </>
      )}

      <Card title="Try a question" subtitle="the same answering the SMS webhook uses — no phone needed">
        <div className="bp__chips">
          {EXAMPLES.map((e) => (
            <button type="button" key={e} className="bp__chip" onClick={() => { setQuestion(e); ask(e); }}>
              {e}
            </button>
          ))}
        </div>
        <textarea
          className="bp__urls"
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about the platform or a business…"
        />
        <div className="bp__rowactions">
          <Button onClick={() => ask()} disabled={asking || !question.trim()}>
            {asking ? 'Thinking…' : 'Ask'}
          </Button>
        </div>

        {asking && <LoadingBlock label="Running the queries…" />}
        {askError && <ErrorState error={askError} onRetry={() => ask()} context="ask" />}
        {reply && (
          <div className="tsd__reply">
            <p className="tsd__answer">{reply.answer}</p>
            <p className="an__note">
              {reply.tools_used?.length
                ? <>Answered from: {reply.tools_used.map((t) => <code key={t} className="mono">{t}</code>).reduce((a, b) => [a, ' · ', b])}</>
                : 'No data query was needed for this.'}
              {' · '}{reply.duration_ms}ms
            </p>
          </div>
        )}
      </Card>

      <div style={{ height: 'var(--space-4)' }} />

      <Card
        title="Who can text in"
        subtitle="the phone number is the only credential a text carries, so this list is the authentication"
      >
        <Notice tone="info" title="Nothing else is accepted">
          <p>
            A text from a number that is not on this list is logged and ignored — no reply, no data.
            Numbers are stored in E.164 form; typing 2515550100 is fine, it will be normalised to +12515550100.
          </p>
        </Notice>
        <div style={{ height: 'var(--space-3)' }} />

        <div className="tsd__add">
          <input className="bp__urls" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+1 251 555 0100" />
          <input className="bp__urls" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Whose phone is this?" />
          <Button onClick={addNumber} disabled={!newPhone.trim()}>Add</Button>
        </div>

        {list.loading && <LoadingBlock label="Loading…" />}
        {list.error && <ErrorState error={list.error} onRetry={list.reload} context="allowlist" />}
        {!list.loading && !list.error && (
          list.data?.numbers?.length
            ? (
              <DataTable
                columns={[
                  { key: 'phone', header: 'Number', render: (n) => <code className="mono">{n.phone}</code> },
                  { key: 'label', header: 'Who', render: (n) => n.label || <span className="muted">—</span> },
                  { key: 'is_active', header: 'Active', render: (n) => <Badge tone={n.is_active ? 'success' : 'neutral'}>{n.is_active ? 'on' : 'off'}</Badge> },
                  { key: 'last_used_at', header: 'Last texted', render: (n) => n.last_used_at ? new Date(n.last_used_at).toLocaleString() : <span className="muted">never</span> },
                  {
                    key: '__act', header: '', align: 'right',
                    render: (n) => (
                      <span className="bp__rowactions">
                        <Button
                          variant="ghost"
                          onClick={async () => {
                            await api.patch(endpoints.dashboardSms.allowlistItem(n.id), { is_active: !n.is_active });
                            list.run();
                          }}
                        >
                          {n.is_active ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={async () => {
                            await api.del(endpoints.dashboardSms.allowlistItem(n.id));
                            toast.success('Removed');
                            list.run();
                          }}
                        >
                          Remove
                        </Button>
                      </span>
                    ),
                  },
                ]}
                rows={list.data.numbers}
                pageSize={10}
              />
            )
            : <EmptyState title="No numbers yet" description="Until one is added, every inbound text is ignored." />
        )}
      </Card>

      <div style={{ height: 'var(--space-4)' }} />

      <Card
        title="What has been asked"
        subtitle="every question and answer, including the ones that were refused"
        actions={<Button onClick={() => log.reload()}>Refresh</Button>}
      >
        {tools.length > 0 && (
          <>
            <p className="an__note">
              What it can look up. Adding a capability is a change to the API — nothing widens by itself.
            </p>
            <div className="bp__chips">
              {tools.map((t) => <span key={t} className="bp__chip">{t}</span>)}
            </div>
          </>
        )}
        {log.data?.log?.length
          ? (
            <DataTable
              columns={[
                { key: 'created_at', header: 'When', render: (r) => new Date(r.created_at).toLocaleString() },
                { key: 'from_phone', header: 'From', render: (r) => <code className="mono">{r.from_phone || '—'}</code> },
                { key: 'question', header: 'Asked', searchable: true },
                {
                  key: 'answer', header: 'Replied',
                  render: (r) => r.allowed === false
                    ? <Badge tone="warning">not allowlisted</Badge>
                    : (r.answer || <Badge tone="warning">{r.error || 'no reply'}</Badge>),
                },
              ]}
              rows={log.data.log}
              pageSize={15}
              searchable
            />
          )
          : <EmptyState title="Nothing asked yet" />}
      </Card>
    </div>
  );
}
