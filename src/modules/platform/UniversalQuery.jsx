/**
 * Universal Query — ask about any business data and make audited edits.
 *
 * Everything goes through gcr-api-clean /api/admin/query (never Supabase):
 *   GET  /schema            resources, filters, writable fields
 *   POST /                  structured query (paged)
 *   POST /nl                plain-English → structured query (deterministic; you review it)
 *   POST /mutate            preview (diff) then commit with reason + expected_version
 *   GET  /audit             who/when/what/why
 *   POST /owner-links/preview | /owner-links/commit   CSV owner→slug linking
 */
import { useState } from 'react';
import { api } from '../../api/client.js';
import { useAsync } from '../../hooks/useAsync.js';
import { PageHeader, Card, Badge, Button, Notice, LoadingBlock, ErrorState } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';

const BASE = '/api/admin/query';
const errText = (e) => e?.body?.error?.message || e?.message || 'Request failed';
const newKey = () => `ui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function QueryPanel({ schema, onEdit }) {
  const [question, setQuestion] = useState('');
  const [draft, setDraft] = useState('{\n  "version": "v1",\n  "resource": "bookings",\n  "filters": {},\n  "page": { "number": 1, "size": 50 }\n}');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const translate = async () => {
    setError(null);
    try {
      const r = await api.post(`${BASE}/nl`, { question });
      if (!r.matched) return setError(`Not understood. Try: ${(r.examples || []).join(' · ')}`);
      setDraft(JSON.stringify(r.special ? { ...r.query, special: r.special } : r.query, null, 2));
    } catch (e) { setError(errText(e)); }
  };
  const run = async (pageNumber) => {
    setBusy(true); setError(null);
    try {
      const body = JSON.parse(draft);
      if (pageNumber) body.page = { ...(body.page || {}), number: pageNumber };
      setDraft(JSON.stringify(body, null, 2));
      setResult(await api.post(BASE, body));
    } catch (e) { setError(e instanceof SyntaxError ? 'Query is not valid JSON' : errText(e)); }
    finally { setBusy(false); }
  };
  const cols = result?.rows?.[0] ? Object.keys(result.rows[0]).map((k) => ({ key: k, header: k, render: (r) => (typeof r[k] === 'object' && r[k] !== null ? JSON.stringify(r[k]) : String(r[k] ?? '')) })) : [];

  return (
    <Card title="Ask" subtitle="Plain English is turned into a query you can see and edit before it runs. Questions never change data.">
      <div style={{ display: 'flex', gap: 8 }}>
        <input style={{ flex: 1 }} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. cancelled bookings for test-pizza-shop last 30 days" onKeyDown={(e) => e.key === 'Enter' && translate()} />
        <Button onClick={translate}>Translate</Button>
      </div>
      <textarea rows={9} style={{ width: '100%', fontFamily: 'monospace', marginTop: 8 }} value={draft} onChange={(e) => setDraft(e.target.value)} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button onClick={() => run()} disabled={busy}>{busy ? 'Running…' : 'Run query'}</Button>
        {schema && <span>Resources: {Object.keys(schema.resources).join(', ')}</span>}
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      {result && (
        <>
          <p>{result.page.total ?? result.rows.length} total · page {result.page.number}</p>
          <DataTable columns={cols} rows={result.rows} searchable={false} onRowClick={(row) => onEdit(result.resource, row)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button disabled={result.page.number <= 1} onClick={() => run(result.page.number - 1)}>Previous</Button>
            <Button disabled={!result.page.has_more} onClick={() => run(result.page.number + 1)}>Next</Button>
          </div>
        </>
      )}
    </Card>
  );
}

const ACTION_FOR = { businesses: 'business.update', bookings: 'booking.update', intake: 'intake.update_status', availability: 'availability.upsert' };

function EditPanel({ schema, seed }) {
  const [action, setAction] = useState(seed?.action || 'business.update');
  const [target, setTarget] = useState(seed?.target || { slug: '' });
  const [values, setValues] = useState('{}');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(null);
  const [key, setKey] = useState(newKey());
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const spec = schema?.mutations?.[action];

  const call = async (mode) => {
    setError(null); setMsg(null);
    try {
      const body = { version: 'v1', action, mode, target, values: JSON.parse(values), reason, idempotency_key: key };
      if (preview?.current_version) body.expected_version = preview.current_version;
      const r = await api.post(`${BASE}/mutate`, body);
      if (mode === 'preview') setPreview(r);
      else { setMsg(r.noop ? 'No changes.' : `Saved. Audit ${r.audit_id}`); setPreview(null); setKey(newKey()); }
    } catch (e) { setError(e instanceof SyntaxError ? 'Values must be valid JSON' : `${errText(e)}${e?.body?.error?.details?.errors ? ' — ' + JSON.stringify(e.body.error.details.errors) : ''}`); }
  };

  return (
    <Card title="Edit" subtitle="Preview shows the exact before → after. Nothing is saved until you confirm. A reason is required.">
      <select value={action} onChange={(e) => { setAction(e.target.value); setPreview(null); }}>
        {Object.keys(schema?.mutations || {}).map((a) => <option key={a}>{a}</option>)}
      </select>
      <input placeholder="slug" value={target.slug || ''} onChange={(e) => setTarget({ ...target, slug: e.target.value.trim() })} />
      <input placeholder="record id (bookings / intake)" value={target.id || ''} onChange={(e) => setTarget({ ...target, id: e.target.value.trim() || undefined })} />
      {spec && <p>Writable: {spec.fields.join(', ')}{spec.required.length ? ` · required: ${spec.required.join(', ')}` : ''}</p>}
      <textarea rows={5} style={{ width: '100%', fontFamily: 'monospace' }} value={values} onChange={(e) => { setValues(e.target.value); setPreview(null); }} />
      <input style={{ width: '100%' }} placeholder="Reason for this change (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <Button onClick={() => call('preview')}>Preview</Button>
      {preview && (
        <div>
          <table><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
            <tbody>{Object.entries(preview.changes).map(([f, c]) => <tr key={f}><td>{f}</td><td>{JSON.stringify(c.from)}</td><td>{JSON.stringify(c.to)}</td></tr>)}</tbody></table>
          {Object.keys(preview.changes).length ? <Button variant="danger" onClick={() => call('commit')}>Confirm and save</Button> : <p>No differences.</p>}
        </div>
      )}
      {msg && <Notice tone="success">{msg}</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}
    </Card>
  );
}

function OwnerImport() {
  const [csv, setCsv] = useState('owner_email,slug\n');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(null);
  const [out, setOut] = useState(null);
  const [error, setError] = useState(null);
  const doPreview = async () => { setError(null); setOut(null); try { setPreview(await api.post(`${BASE}/owner-links/preview`, { csv })); } catch (e) { setError(errText(e)); } };
  const commit = async (offset = 0) => {
    setError(null);
    try { setOut(await api.post(`${BASE}/owner-links/commit`, { csv, preview_token: preview.preview_token, reason, confirm: true, batch_offset: offset })); }
    catch (e) { setError(errText(e)); }
  };
  return (
    <Card title="Link owners to businesses (CSV)" subtitle="owner_email,slug[,role]. Emails must match exactly one existing account. No accounts are created.">
      <textarea rows={6} style={{ width: '100%', fontFamily: 'monospace' }} value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); }} />
      <Button onClick={doPreview}>Preview (dry run)</Button>
      {preview && (
        <>
          <p>{Object.entries(preview.summary).map(([k, n]) => <Badge key={k} tone={k === 'ready' ? 'success' : 'warning'}>{k}: {n}</Badge>)}</p>
          <DataTable columns={['line', 'owner_email', 'slug', 'role', 'status'].map((k) => ({ key: k, header: k }))} rows={preview.rows} rowKey="line" />
          <input style={{ width: '100%' }} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button variant="danger" disabled={!preview.ready_count || reason.trim().length < 3} onClick={() => commit(0)}>Link {Math.min(preview.ready_count, preview.max_batch)} ready rows</Button>
        </>
      )}
      {out && <Notice tone="info">Linked {out.committed}. {out.next_batch_offset != null && <Button onClick={() => commit(out.next_batch_offset)}>Next batch</Button>}</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}
    </Card>
  );
}

function AuditPanel() {
  const audit = useAsync(() => api.get(`${BASE}/audit`, { query: { size: 100 } }), []);
  if (audit.loading) return <LoadingBlock />;
  if (audit.error) return <ErrorState error={audit.error} onRetry={audit.reload} context="Audit log (needs the audit table migration)" />;
  return (
    <Card title="Audit log">
      <DataTable rows={audit.data?.rows || []} columns={[
        { key: 'created_at', header: 'When' }, { key: 'actor_email', header: 'Who' }, { key: 'action', header: 'Action' },
        { key: 'entity_slug', header: 'Slug' }, { key: 'reason', header: 'Reason' }, { key: 'status', header: 'Status' },
        { key: 'changes', header: 'Changes', render: (r) => JSON.stringify(r.changes) },
      ]} />
    </Card>
  );
}

export default function UniversalQuery() {
  const schema = useAsync(() => api.get(`${BASE}/schema`), []);
  const [tab, setTab] = useState('ask');
  const [seed, setSeed] = useState(null);
  const onEdit = (resource, row) => {
    const action = ACTION_FOR[resource]; if (!action) return;
    setSeed({ action, target: { slug: row.slug || row.entity_slug, id: resource === 'businesses' ? undefined : row.id } });
    setTab('edit');
  };
  return (
    <>
      <PageHeader title="Universal Query" description="Ask about bookings, businesses, owners, units, payments, reviews, availability and intake. Edits are previewed, need a reason, and are logged." />
      {schema.loading && <LoadingBlock />}
      {schema.error && <ErrorState error={schema.error} onRetry={schema.reload} context="/api/admin/query/schema" />}
      {schema.data && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {['ask', 'edit', 'owners', 'audit'].map((t) => <Button key={t} variant={tab === t ? 'primary' : 'ghost'} onClick={() => setTab(t)}>{t === 'owners' ? 'Owner links' : t[0].toUpperCase() + t.slice(1)}</Button>)}
          </div>
          {Object.entries(schema.data.external_sources || {}).some(([, s]) => !s.enabled) && (
            <Notice tone="warning" title="Paperclip / Jarvis not connected">{Object.entries(schema.data.external_sources).filter(([, s]) => !s.enabled).map(([k, s]) => <div key={k}><b>{k}</b>: {s.blocker}</div>)}</Notice>
          )}
          {tab === 'ask' && <QueryPanel schema={schema.data} onEdit={onEdit} />}
          {tab === 'edit' && <EditPanel key={JSON.stringify(seed)} schema={schema.data} seed={seed} />}
          {tab === 'owners' && <OwnerImport />}
          {tab === 'audit' && <AuditPanel />}
        </>
      )}
    </>
  );
}
