/**
 * Intake — businesses handing over their links, and the webhooks that
 * announce them.
 *
 * A business submits its website, Google listing, booking pages and socials.
 * That creates a request, every listening webhook fires, and this is the queue
 * you work: open one, jump to that business's profile, run the extraction
 * against those links, mark it done.
 *
 * The webhook half is here rather than in Settings because a queue you are not
 * being told about is just a page you forget to check. Destinations are rows,
 * not config in code — add one, pause it, point it somewhere else, no deploy.
 * The delivery log is beside them because a webhook that quietly stopped
 * firing is the failure that actually happens.
 *
 * GET/PATCH /api/admin/intake
 * GET/POST/PATCH/DELETE /api/admin/intake/webhooks/endpoints
 * GET /api/admin/intake/webhooks/deliveries
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { useAsync } from '../../hooks/useAsync.js';
import {
  PageHeader, Card, Stat, Badge, Button, Notice,
  LoadingBlock, ErrorState, EmptyState,
} from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { fields } from '../../lib/fields.jsx';
import '../../ui/chips.css';
import '../engagement/charts.css';

const STATUSES = ['new', 'in_progress', 'done', 'rejected'];

const ENDPOINT_SCHEMA = [
  fields.text('label', 'Name', { help: 'What this destination is, for your own reference.' }),
  fields.url('url', 'URL', { required: true, help: 'Where the POST goes — Zapier, Make, Slack, your own server.' }),
  fields.text('event', 'Event', {
    required: true,
    help: 'intake.created, intake.done, intake.rejected, or * for everything.',
  }),
  fields.text('secret', 'Signing secret', {
    help: 'Optional. If set, each call carries X-GCR-Signature so the receiver can verify it came from you.',
  }),
  fields.bool('is_active', 'Active'),
];

export default function Intake() {
  const toast = useToast();
  const [status, setStatus] = useState('new');
  const [editingEndpoint, setEditingEndpoint] = useState(null);

  const queue = useAsync(
    async () => api.get(endpoints.intake.list(), { query: { status } }),
    [status],
    { initialData: null },
  );
  const hooks = useAsync(async () => api.get(endpoints.intake.endpoints()), [], { initialData: null });
  const log = useAsync(async () => api.get(endpoints.intake.deliveries(), { query: { limit: 50 } }), [], { initialData: null });

  const requests = useMemo(
    () => (Array.isArray(queue.data?.requests) ? queue.data.requests : []),
    [queue.data],
  );

  const setStatusOf = async (row, next) => {
    await api.patch(endpoints.intake.item(row.id), { status: next });
    toast.success(`Marked ${next.replace('_', ' ')}`);
    queue.run();
  };

  const columns = useMemo(() => [
    {
      key: 'business_name',
      header: 'Business',
      sortable: true,
      searchable: true,
      render: (r) => (
        <div>
          <div>{r.business_name || <span className="muted">unnamed</span>}</div>
          {r.entity_slug
            ? <Link to={`/directory/profile/${r.entity_slug}`}>{r.entity_slug}</Link>
            : <span className="muted" style={{ fontSize: 12 }}>not in the directory yet</span>}
        </div>
      ),
    },
    {
      key: 'links',
      header: 'Links',
      render: (r) => (
        <div className="bp__chips">
          {(r.links || []).map((l) => (
            <a key={l.id} className="bp__chip" href={l.url} target="_blank" rel="noreferrer" title={l.url}>
              {l.kind}
            </a>
          ))}
          {!r.links?.length && <span className="muted">—</span>}
        </div>
      ),
    },
    {
      key: 'contact_name',
      header: 'Contact',
      searchable: true,
      render: (r) => (
        <div style={{ fontSize: 13 }}>
          <div>{r.contact_name || '—'}</div>
          <div className="muted">{r.contact_email || r.contact_phone || ''}</div>
        </div>
      ),
    },
    { key: 'created_at', header: 'Received', sortable: true, render: (r) => new Date(r.created_at).toLocaleString() },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (r) => <Badge tone={r.status === 'done' ? 'success' : r.status === 'rejected' ? 'neutral' : 'warning'}>{r.status}</Badge>,
    },
    {
      key: '__act',
      header: '',
      align: 'right',
      render: (r) => (
        <span className="bp__rowactions">
          {r.entity_slug && (
            <Link to={`/directory/profile/${r.entity_slug}`}>
              <Button variant="ghost">Open profile</Button>
            </Link>
          )}
          {r.status !== 'done' && <Button variant="ghost" onClick={() => setStatusOf(r, 'done')}>Done</Button>}
        </span>
      ),
    },
  ], [queue]);

  const endpointColumns = useMemo(() => [
    { key: 'label', header: 'Name', render: (e) => e.label || <span className="muted">unnamed</span> },
    { key: 'event', header: 'Event', render: (e) => <code className="mono">{e.event}</code> },
    { key: 'url', header: 'URL', render: (e) => <span className="bp__srcurl">{e.url}</span> },
    { key: 'is_active', header: 'Active', render: (e) => <Badge tone={e.is_active ? 'success' : 'neutral'}>{e.is_active ? 'on' : 'paused'}</Badge> },
    {
      key: '__act',
      header: '',
      align: 'right',
      render: (e) => (
        <span className="bp__rowactions">
          <Button
            variant="ghost"
            onClick={async () => {
              const r = await api.post(endpoints.intake.testEndpoint(e.id), {});
              toast.info(`Delivered to ${r.delivered}/${r.endpoints}`);
              log.run();
            }}
          >
            Test
          </Button>
          <Button variant="ghost" onClick={() => setEditingEndpoint(e)}>Edit</Button>
        </span>
      ),
    },
  ], [toast, log]);

  const counts = queue.data?.counts || {};
  const failed = log.data?.failed_recently ?? 0;

  return (
    <div>
      <PageHeader
        title="Intake"
        description="Businesses handing over their links — and the webhooks that tell you about it."
        actions={
          <>
            {['new', 'in_progress', 'done', 'all'].map((s) => (
              <Button key={s} variant={s === status ? 'primary' : 'ghost'} onClick={() => setStatus(s)}>
                {s.replace('_', ' ')}
              </Button>
            ))}
            <Button onClick={queue.run}>Refresh</Button>
          </>
        }
      />

      <div className="an__stats">
        {STATUSES.map((s) => <Stat key={s} label={s.replace('_', ' ')} value={counts[s] ?? 0} />)}
        <Stat
          label="Failed deliveries"
          value={failed}
          tone={failed ? 'warning' : 'neutral'}
          hint="last 50 attempts"
        />
      </div>

      {!hooks.loading && !hooks.data?.endpoints?.length && (
        <>
          <Notice tone="warning" title="Nothing is listening yet">
            <p>
              Submissions are being saved, but no webhook is configured, so nothing tells you one arrived —
              you would have to remember to check this page. Add a destination below: a Zapier or Make hook,
              a Slack incoming webhook, or your own endpoint.
            </p>
          </Notice>
          <div style={{ height: 'var(--space-4)' }} />
        </>
      )}

      <Card title="Queue" subtitle={`${requests.length} ${status === 'all' ? 'total' : status.replace('_', ' ')}`}>
        {queue.loading && <LoadingBlock label="Loading requests…" />}
        {queue.error && <ErrorState error={queue.error} onRetry={queue.run} context="intake queue" />}
        {!queue.loading && !queue.error && (
          requests.length
            ? <DataTable columns={columns} rows={requests} pageSize={25} searchable emptyLabel="Nothing here" />
            : <EmptyState title="Nothing waiting" description="Submissions appear here the moment they arrive." />
        )}
      </Card>

      <div style={{ height: 'var(--space-4)' }} />

      <Card
        title="Where you get notified"
        subtitle="Destinations are rows in the database — add, pause or repoint one with no deploy"
        actions={<Button onClick={() => setEditingEndpoint({ event: 'intake.created', is_active: true })}>Add destination</Button>}
      >
        {hooks.loading && <LoadingBlock label="Loading destinations…" />}
        {hooks.error && <ErrorState error={hooks.error} onRetry={hooks.run} context="webhook endpoints" />}
        {!hooks.loading && !hooks.error && (
          hooks.data?.endpoints?.length
            ? <DataTable columns={endpointColumns} rows={hooks.data.endpoints} pageSize={10} />
            : <EmptyState title="No destinations" description="Nothing is being notified when a business submits." />
        )}
      </Card>

      <div style={{ height: 'var(--space-4)' }} />

      <Card title="Recent deliveries" subtitle="whether the notifications are actually arriving">
        {log.data?.deliveries?.length
          ? (
            <DataTable
              columns={[
                { key: 'created_at', header: 'When', render: (d) => new Date(d.created_at).toLocaleString() },
                { key: 'event', header: 'Event', render: (d) => <code className="mono">{d.event}</code> },
                { key: 'target_url', header: 'To', render: (d) => <span className="bp__srcurl">{d.target_url}</span> },
                {
                  key: 'status',
                  header: 'Result',
                  render: (d) => (
                    <Badge tone={d.status === 'delivered' ? 'success' : 'warning'}>
                      {d.status === 'delivered' ? `${d.response_code} · ${d.duration_ms}ms` : (d.error || 'failed')}
                    </Badge>
                  ),
                },
              ]}
              rows={log.data.deliveries}
              pageSize={15}
            />
          )
          : <EmptyState title="Nothing sent yet" />}
      </Card>

      {editingEndpoint && (
        <Modal
          open
          title={editingEndpoint.id ? 'Edit destination' : 'Add destination'}
          onClose={() => setEditingEndpoint(null)}
          size="md"
        >
          <SchemaForm
            schema={ENDPOINT_SCHEMA}
            initialValues={editingEndpoint}
            submitLabel={editingEndpoint.id ? 'Save' : 'Add'}
            onCancel={() => setEditingEndpoint(null)}
            onSubmit={async (values) => {
              if (editingEndpoint.id) await api.patch(endpoints.intake.endpoint(editingEndpoint.id), values);
              else await api.post(endpoints.intake.endpoints(), values);
              toast.success('Saved');
              setEditingEndpoint(null);
              hooks.run();
            }}
            extraActions={
              editingEndpoint.id ? (
                <Button
                  variant="danger"
                  onClick={async () => {
                    await api.del(endpoints.intake.endpoint(editingEndpoint.id));
                    toast.success('Removed');
                    setEditingEndpoint(null);
                    hooks.run();
                  }}
                >
                  Remove
                </Button>
              ) : null
            }
          />
        </Modal>
      )}
    </div>
  );
}
