/**
 * Automations — everything you have built, and where each one stands.
 *
 * GET  /api/admin/automations
 * POST /api/admin/automations
 *
 * An automation is data: a trigger, a list of steps, and the settings a
 * business may fill in. This screen lists them; the builder edits one. The
 * status columns tell the "cloud update" story at a glance — the latest
 * published version, how many businesses have it, and how many are behind.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { useAsync } from '../../hooks/useAsync.js';
import {
  PageHeader, Card, Stat, Badge, Button, LoadingBlock, ErrorState, EmptyState, Notice,
} from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { fields, formatDateTime } from '../../lib/fields.jsx';
import './automations.css';

const STATUS_TONES = { draft: 'neutral', published: 'success', archived: 'warning' };

export const TRIGGER_LABELS = {
  manual: 'Run by hand',
  schedule: 'On a schedule',
  event: 'On an event',
  webhook: 'When a URL is called',
};

export function describeTrigger(trigger) {
  if (!trigger) return '—';
  if (trigger.type === 'schedule') {
    const at = trigger.at || '09:00';
    if (trigger.every === 'hour') return 'Every hour';
    if (trigger.every === 'week') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `Weekly, ${days[Number(trigger.day_of_week ?? 1)]} at ${at}`;
    }
    return `Daily at ${at}`;
  }
  if (trigger.type === 'event') return `On ${trigger.event || '…'}`;
  return TRIGGER_LABELS[trigger.type] || trigger.type;
}

const CREATE_SCHEMA = [
  fields.text('name', 'Name', { required: true, span: 'full', placeholder: 'Weekly menu reminder' }),
  fields.text('key', 'Key', {
    help: 'Stable handle. Left blank, it is made from the name.',
    validate: (v) => (v && !/^[a-z0-9][a-z0-9-]{1,63}$/.test(v) ? 'Lowercase letters, numbers and hyphens' : null),
  }),
  fields.text('icon', 'Icon', { placeholder: '⚡', defaultValue: '⚡' }),
  fields.select('kind', 'Kind', [
    { value: 'automation', label: 'Automation — a trigger and a chain of steps' },
    { value: 'script', label: 'Script — one block of code' },
  ], { defaultValue: 'automation', span: 'full' }),
  fields.text('category', 'Category', { placeholder: 'marketing, menu, bookings…', defaultValue: 'general' }),
  fields.textarea('description', 'What it does', { rows: 2, help: 'Businesses see this on their dashboard.' }),
];

export default function Automations() {
  const toast = useToast();
  const navigate = useNavigate();
  const [status, setStatus] = useState('all');
  const [creating, setCreating] = useState(false);

  const query = useAsync(async () => api.get(endpoints.automations.list(), { query: { status } }), [status], { initialData: null });
  const rows = useMemo(() => query.data?.automations || [], [query.data]);

  const totals = useMemo(() => rows.reduce((acc, a) => {
    acc.installs += a.stats?.installs || 0;
    acc.behind += a.stats?.behind || 0;
    if (a.status === 'published') acc.published += 1;
    return acc;
  }, { installs: 0, behind: 0, published: 0 }), [rows]);

  const columns = useMemo(() => [
    {
      key: 'name',
      header: 'Automation',
      sortable: true,
      searchable: true,
      render: (a) => (
        <div className="au__name">
          <span className="au__name-icon">{a.icon || '⚡'}</span>
          <div className="au__name-text">
            <Link to={`/automations/build/${a.id}`}>{a.name}</Link>
            <span className="au__name-sub mono">{a.key} · {a.kind}</span>
          </div>
        </div>
      ),
    },
    { key: 'trigger', header: 'Trigger', render: (a) => describeTrigger(a.trigger), value: (a) => a.trigger?.type },
    { key: 'steps', header: 'Steps', align: 'right', value: (a) => (a.steps || []).length, render: (a) => (a.steps || []).length },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (a) => (
        <span className="row-wrap" style={{ gap: 4 }}>
          <Badge tone={STATUS_TONES[a.status] || 'neutral'}>{a.status}</Badge>
          {a.version > 0 && <Badge tone="info">v{a.version}</Badge>}
        </span>
      ),
    },
    {
      key: 'installs',
      header: 'Businesses',
      align: 'right',
      value: (a) => a.stats?.installs || 0,
      sortable: true,
      render: (a) => (
        <div style={{ textAlign: 'right' }}>
          <div>{a.stats?.installs || 0}</div>
          {a.stats?.behind > 0 && <div className="au__name-sub" style={{ color: 'var(--warning)' }}>{a.stats.behind} behind</div>}
        </div>
      ),
    },
    {
      key: 'last_deployment',
      header: 'Last push',
      value: (a) => a.last_deployment?.created_at || '',
      sortable: true,
      render: (a) => a.last_deployment
        ? <span className="muted">v{a.last_deployment.version} · {formatDateTime(a.last_deployment.created_at)}</span>
        : <span className="faint">never</span>,
    },
    {
      key: '__act',
      header: '',
      align: 'right',
      render: (a) => <Link to={`/automations/build/${a.id}`}><Button variant="ghost" size="sm">Open</Button></Link>,
    },
  ], []);

  return (
    <div>
      <PageHeader
        title="Automations"
        description="Build once, push to every business. Each business runs the version you gave it, never the draft."
        actions={
          <>
            {['all', 'draft', 'published', 'archived'].map((s) => (
              <Button key={s} variant={s === status ? 'primary' : 'ghost'} onClick={() => setStatus(s)}>{s}</Button>
            ))}
            <Button onClick={() => query.reload()}>Refresh</Button>
            <Button variant="primary" onClick={() => setCreating(true)}>New automation</Button>
          </>
        }
      />

      <div className="au__stats">
        <Stat label="Automations" value={rows.length} />
        <Stat label="Published" value={totals.published} />
        <Stat label="Installs" value={totals.installs} hint="business × automation" />
        <Stat label="Behind latest" value={totals.behind} tone={totals.behind ? 'warning' : 'neutral'} />
      </div>

      {!query.loading && !query.error && rows.length === 0 && status === 'all' && (
        <>
          <Notice tone="info" title="Nothing built yet">
            <p>
              Create one, add steps from the palette, test it against a business, publish a version, then push it to
              everyone. Businesses see it on their dashboard under <b>Automations</b> the moment it lands.
            </p>
          </Notice>
          <div className="au__gap" />
        </>
      )}

      <Card title="All automations" subtitle={`${rows.length} ${status === 'all' ? 'total' : status}`}>
        {query.loading && <LoadingBlock label="Loading automations…" />}
        {query.error && <ErrorState error={query.error} onRetry={query.reload} context="automations" />}
        {!query.loading && !query.error && (
          rows.length
            ? <DataTable columns={columns} rows={rows} pageSize={25} searchable searchPlaceholder="Search automations…" />
            : <EmptyState icon="⚡" title="No automations" description="Nothing here for this filter." />
        )}
      </Card>

      {creating && (
        <Modal open title="New automation" onClose={() => setCreating(false)} size="md">
          <SchemaForm
            schema={CREATE_SCHEMA}
            submitLabel="Create and open"
            onCancel={() => setCreating(false)}
            onSubmit={async (values) => {
              const { automation } = await api.post(endpoints.automations.create(), values);
              toast.success(`Created ${automation.name}`);
              setCreating(false);
              navigate(`/automations/build/${automation.id}`);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
