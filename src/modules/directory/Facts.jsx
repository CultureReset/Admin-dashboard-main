/**
 * Facts — the fill-in queue, the review queue, evidence and coverage.
 *
 *   GET  /api/admin/facts/questions?slug=   what is still unknown for one business
 *   POST /api/admin/facts/answers           { slug, answers: [{ fact, value | maybe | unknown, note? }] }
 *   GET  /api/admin/facts/proposed          model-proposed answers waiting for a person
 *   POST /api/admin/facts/proposed/:id      { approve: boolean }
 *   GET  /api/admin/facts/evidence?slug=    what is held about a business
 *   POST /api/admin/facts/propose           { slug, facts? } ask the model to propose answers now
 *   GET  /api/facts/coverage                how much of each fact is known (admin)
 *
 * Every admin call names the business explicitly; the API checks the caller
 * against platform_admins. Questions, choices and value types come from the
 * registry tables via the API, so a new fact appears here with no deploy.
 */

import { useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { TabBar } from '../../ui/Tabs.jsx';
import { useConfirm } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { EntityPicker, useEntities } from '../../components/EntityPicker.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { formatDateTime } from '../../lib/fields.jsx';
import './Facts.css';

const TABS = [
  { id: 'fill', label: 'Fill in' },
  { id: 'review', label: 'Review queue' },
  { id: 'evidence', label: 'Evidence & propose' },
  { id: 'coverage', label: 'Coverage' },
];

/** What a proposed/observed row is saying, whichever column carries it. */
function observedValue(row) {
  if (row.v_bool != null) return row.v_bool ? 'Yes' : 'No';
  if (row.v_num != null) return String(row.v_num);
  if (row.v_text) return row.v_text;
  return row.value_state || '—';
}

/* ── Fill in ───────────────────────────────────────────────────────────── */

function AnswerInput({ question, value, onChange, disabled }) {
  const choices = question.choices || [];
  if (question.value_type === 'bool') {
    return (
      <select className="ui-input ui-input--select" value={value} disabled={disabled} aria-label={question.label}
        onChange={(e) => onChange(e.target.value)}>
        <option value="">Unanswered</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  if (choices.length) {
    return (
      <select className="ui-input ui-input--select" value={value} disabled={disabled} aria-label={question.label}
        onChange={(e) => onChange(e.target.value)}>
        <option value="">Unanswered</option>
        {choices.map((c) => <option key={c.value} value={c.value}>{c.label || c.value}</option>)}
      </select>
    );
  }
  const numeric = question.value_type === 'int' || question.value_type === 'num';
  return (
    <input className="ui-input" value={value} disabled={disabled} aria-label={question.label}
      type={numeric ? 'number' : 'text'} step={question.value_type === 'int' ? 1 : 'any'}
      inputMode={numeric ? 'decimal' : undefined} placeholder="Unanswered"
      onChange={(e) => onChange(e.target.value)} />
  );
}

function FillIn({ slug }) {
  const toast = useToast();
  const [draft, setDraft] = useState({});     // fact -> string | { mark: 'maybe' | 'unknown' }
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);

  const query = useAsync(
    async () => {
      setDraft({});
      setErrors([]);
      return unwrapList(await api.get(endpoints.facts.questions(), { query: { slug } }), ['questions']);
    },
    [slug],
    { initialData: [] },
  );
  const questions = query.data || [];

  const grouped = useMemo(() => {
    const map = new Map();
    for (const q of questions) {
      const key = q.domain || 'other';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(q);
    }
    return [...map.entries()];
  }, [questions]);

  const setValue = (fact, value) => setDraft((d) => ({ ...d, [fact]: value }));
  const setMark = (fact, mark) =>
    setDraft((d) => ({ ...d, [fact]: d[fact]?.mark === mark ? '' : { mark } }));

  const answers = questions.flatMap((q) => {
    const d = draft[q.fact];
    if (d && typeof d === 'object') return [{ fact: q.fact, [d.mark === 'maybe' ? 'maybe' : 'unknown']: true }];
    if (d === '' || d == null) return [];
    if (q.value_type === 'bool') return [{ fact: q.fact, value: d === 'true' }];
    if (q.value_type === 'int' || q.value_type === 'num') return [{ fact: q.fact, value: Number(d) }];
    return [{ fact: q.fact, value: d }];
  });

  const submit = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const result = await api.post(endpoints.facts.answers(), { slug, answers });
      toast.success(`${result?.saved ?? answers.length} answer(s) saved.`);
      await query.reload();
    } catch (err) {
      const list = err?.body?.errors;
      if (Array.isArray(list) && list.length) setErrors(list.map(String));
      else toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (query.loading) return <LoadingBlock label="Loading open questions…" />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.reload} context="fact questions" />;
  if (!questions.length) {
    return <EmptyState icon="✓" title="Nothing left to ask" description="Every fact that applies to this business has an answer." />;
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: 'var(--space-2)' }}>
        {questions.length} open question{questions.length === 1 ? '' : 's'}. Fill in what you know; leave the rest.
        Answers entered here are recorded as an administrator&rsquo;s.
      </p>
      {errors.length > 0 && (
        <Notice tone="danger" title="Some answers were not accepted">
          <ul style={{ margin: 0, paddingLeft: 18 }}>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </Notice>
      )}
      {grouped.map(([domain, list]) => (
        <section key={domain}>
          <h3 className="facts__domain">{domain.replace(/_/g, ' ')}</h3>
          {list.map((q) => {
            const d = draft[q.fact];
            const mark = d && typeof d === 'object' ? d.mark : null;
            return (
              <div className="facts__q" key={q.fact}>
                <div className="facts__q-label">
                  {q.label}
                  <span className="facts__q-key mono">{q.fact}</span>
                </div>
                <div className="facts__q-input">
                  <AnswerInput question={q} value={typeof d === 'string' ? d : ''} disabled={!!mark || saving}
                    onChange={(v) => setValue(q.fact, v)} />
                </div>
                <div className="facts__q-marks">
                  <Button size="sm" variant={mark === 'maybe' ? 'primary' : 'ghost'} onClick={() => setMark(q.fact, 'maybe')}>Depends</Button>
                  <Button size="sm" variant={mark === 'unknown' ? 'primary' : 'ghost'} onClick={() => setMark(q.fact, 'unknown')}>Not sure</Button>
                </div>
              </div>
            );
          })}
        </section>
      ))}
      <div className="facts__footer">
        <Button variant="primary" onClick={submit} loading={saving} disabled={!answers.length}>
          Save {answers.length || ''} answer{answers.length === 1 ? '' : 's'}
        </Button>
        {answers.length > 0 && <Button onClick={() => setDraft({})} disabled={saving}>Clear</Button>}
      </div>
    </div>
  );
}

/* ── Review queue ──────────────────────────────────────────────────────── */

function ReviewQueue({ onOpen }) {
  const toast = useToast();
  const [confirm, confirmElement] = useConfirm();
  const [busy, setBusy] = useState(null);
  const query = useAsync(
    async () => unwrapList(await api.get(endpoints.facts.proposed()), ['proposed']),
    [],
    { initialData: [] },
  );

  const decide = async (row, approve) => {
    if (!approve) {
      const ok = await confirm({
        title: 'Reject answer',
        message: `Reject "${observedValue(row)}" for ${row.fact_key} on ${row.entity_slug}? It will not count.`,
        confirmLabel: 'Reject',
      });
      if (!ok) return;
    }
    setBusy(row.id);
    try {
      await api.post(endpoints.facts.decide(row.id), { approve });
      toast.success(approve ? 'Answer approved.' : 'Answer rejected.');
      await query.reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  };

  const cols = [
    { key: 'entity_slug', header: 'Business', render: (r) => (
      <Button size="sm" variant="ghost" onClick={() => onOpen(r.entity_slug)}>{r.entity_slug}</Button>
    ) },
    { key: 'fact_key', header: 'Fact', render: (r) => <span className="mono">{r.fact_key}</span> },
    { key: 'v', header: 'Proposed', value: observedValue, render: (r) => <span className="facts__value">{observedValue(r)}</span> },
    { key: 'confidence', header: 'Confidence', align: 'right',
      render: (r) => (r.confidence != null ? `${Math.round(r.confidence * 100)}%` : <span className="faint">—</span>) },
    { key: 'evidence_note', header: 'Note', render: (r) => <span className="facts__value">{r.evidence_note || <span className="faint">—</span>}</span> },
    { key: 'created_at', header: 'Proposed', render: (r) => formatDateTime(r.created_at) },
    { key: '__actions', header: '', align: 'right', sortable: false, searchable: false,
      render: (r) => (
        <span className="ui-cell-actions">
          <Button size="sm" variant="primary" disabled={busy === r.id} onClick={() => decide(r, true)}>Approve</Button>
          <Button size="sm" variant="danger" disabled={busy === r.id} onClick={() => decide(r, false)}>Reject</Button>
        </span>
      ) },
  ];

  return (
    <>
      <DataTable columns={cols} rows={query.data || []} loading={query.loading} error={query.error} onRetry={query.reload}
        rowKey="id" searchPlaceholder="Search the queue…" emptyTitle="Nothing waiting for review" />
      {confirmElement}
    </>
  );
}

/* ── Evidence & propose ────────────────────────────────────────────────── */

function Evidence({ slug }) {
  const toast = useToast();
  const [proposing, setProposing] = useState(false);
  const [result, setResult] = useState(null);

  const query = useAsync(
    async () => {
      setResult(null);
      return api.get(endpoints.facts.evidence(), { query: { slug } });
    },
    [slug],
    { initialData: null },
  );

  const propose = async () => {
    setProposing(true);
    try {
      const out = await api.post(endpoints.facts.propose(), { slug });
      setResult(out);
      toast.success(`${(out?.proposals || []).length} proposal(s) waiting in the review queue.`);
    } catch (err) {
      toast.error(err);
    } finally {
      setProposing(false);
    }
  };

  const items = query.data?.items || [];

  return (
    <div className="stack">
      <Card
        title="Propose answers now"
        subtitle="Reads the evidence below and proposes answers for what is still unknown. Nothing counts until you approve it in the review queue."
        actions={<Button variant="primary" onClick={propose} loading={proposing}>Propose answers</Button>}
      >
        {!result && <p className="muted">No proposal run in this session.</p>}
        {result && (
          <div>
            <p>
              <Badge tone="success">{(result.proposals || []).length} proposed</Badge>{' '}
              <Badge tone="neutral">{(result.dropped || []).length} dropped</Badge>{' '}
              <Badge tone="neutral">{(result.skipped || []).length} skipped</Badge>
            </p>
            {(result.proposals || []).map((p) => (
              <div key={p.fact} className="facts__q" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
                <span className="mono">{p.fact}</span>
                <span className="facts__value">{String(p.value)}{p.note ? ` — ${p.note}` : ''}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Evidence held" subtitle={query.data ? `${items.length} items, ${query.data.chars ?? 0} characters` : undefined}>
        {query.loading && <LoadingBlock label="Collecting evidence…" />}
        {query.error && <ErrorState error={query.error} onRetry={query.reload} context="fact evidence" />}
        {!query.loading && !query.error && !items.length && (
          <EmptyState title="No evidence on file" description="There is nothing for the model to read for this business yet." />
        )}
        <div className="facts__evidence">
          {items.map((it) => (
            <div className="facts__evidence-item" key={it.id || it.source}>
              <strong>{it.label}</strong> <span className="mono faint">{it.source}</span>
              <p className="facts__evidence-text">{it.text}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ── Coverage ──────────────────────────────────────────────────────────── */

function Coverage() {
  const query = useAsync(
    async () => unwrapList(await api.get(endpoints.facts.coverage()), ['coverage']),
    [],
    { initialData: [] },
  );
  const num = (key, header) => ({ key, header, align: 'right', render: (r) => (r[key] ?? 0).toLocaleString() });
  const cols = [
    { key: 'label', header: 'Fact', render: (r) => (
      <div><div className="ui-cell-primary">{r.label}</div><div className="ui-cell-sub mono">{r.fact_key}</div></div>
    ) },
    { key: 'domain', header: 'Domain' },
    num('known', 'Known'), num('yes', 'Yes'), num('no', 'No'), num('maybe', 'Depends'),
    num('from_own', 'Own'), num('from_parent', 'Inherited'), num('computed', 'Computed'),
  ];
  return (
    <DataTable columns={cols} rows={query.data || []} loading={query.loading} error={query.error} onRetry={query.reload}
      rowKey="fact_key" searchPlaceholder="Search facts…" emptyTitle="No coverage data" />
  );
}

/* ── Screen ────────────────────────────────────────────────────────────── */

export default function Facts() {
  const { selectedSlug, setSelectedSlug } = useEntities();
  const [tab, setTab] = useState('fill');
  const perBusiness = tab === 'fill' || tab === 'evidence';

  const openBusiness = (slug) => {
    setSelectedSlug(slug);
    setTab('fill');
  };

  return (
    <>
      <PageHeader
        title="Facts"
        description="Answer what is still unknown about a business, review proposed answers, and see how complete each fact is."
      />
      <TabBar tabs={TABS} activeId={tab} onChange={setTab} />
      <div style={{ height: 'var(--space-4)' }} />

      {perBusiness && (
        <div className="facts__bar">
          <EntityPicker value={selectedSlug} onChange={(slug) => setSelectedSlug(slug)} label="Business" />
        </div>
      )}

      {perBusiness && !selectedSlug && <div className="entity-picker__prompt">Pick a business above to continue.</div>}
      {tab === 'fill' && selectedSlug && <FillIn slug={selectedSlug} />}
      {tab === 'evidence' && selectedSlug && <Evidence slug={selectedSlug} />}
      {tab === 'review' && <ReviewQueue onOpen={openBusiness} />}
      {tab === 'coverage' && <Coverage />}
    </>
  );
}
