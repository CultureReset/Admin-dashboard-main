/**
 * Business sign-ups awaiting review.
 *
 * GET   /api/admin/signups            ?status=pending
 * GET   /api/admin/signups/:id        one, with its listing as it stands now
 * PATCH /api/admin/signups/:id        { status, notes }
 *
 * A business that signed itself up by phone created a real row in `entity`,
 * and the public directory has 4,067 genuine listings in it. Nothing they made
 * is visible until it is approved here. Approving flips is_active and
 * show_in_listings; reversing an approval hides it again.
 *
 * Not the same screen as Claims. A claim asks for control of a listing that
 * already exists; a sign-up IS the listing, and the question is whether it
 * should exist at all.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Modal, useConfirm } from '../../ui/Modal.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, fields } from '../../lib/fields.jsx';

const STATUS_TONES = { pending: 'warning', approved: 'success', rejected: 'neutral' };

const decisionSchema = [
  fields.select('status', 'Decision', ['pending', 'approved', 'rejected'], {
    required: true,
    span: 'full',
    help: 'Approving makes the listing public. Rejecting leaves it hidden — the owner keeps their account either way.',
  }),
  fields.textarea('notes', 'Notes', { rows: 3, help: 'Recorded against the sign-up.' }),
];

/** The listings that looked like this one at sign-up. The counterfeit check. */
function Duplicates({ matches, onOpen }) {
  if (!matches?.length) {
    return <p className="faint">Nothing on GCR resembled this name.</p>;
  }
  return (
    <ul className="sec-editor__items">
      {matches.map((match) => (
        <li className="sec-editor__item" key={match.slug}>
          <div className="sec-editor__itembody">
            <div className="sec-editor__itemname">
              {match.name}
              {match.is_active ? (
                <Badge tone="success">Live</Badge>
              ) : (
                <Badge tone="neutral">Hidden</Badge>
              )}
            </div>
            <div className="sec-editor__itemdesc mono">
              {match.slug}
              {match.city ? ` · ${match.city}` : ''}
              {typeof match.score === 'number' ? ` · ${Math.round(match.score * 100)}% name match` : ''}
            </div>
          </div>
          <Button size="sm" onClick={() => onOpen(match.slug)}>Open</Button>
        </li>
      ))}
    </ul>
  );
}

export default function Signups() {
  const toast = useToast();
  const navigate = useNavigate();
  const [reviewing, setReviewing] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [confirm, confirmElement] = useConfirm();

  const { data, loading, error, reload } = useAsync(
    async () => unwrapList(await api.get(endpoints.signups.list()), ['signups']),
    [],
    { initialData: [] },
  );

  const signups = data || [];

  const counts = useMemo(() => {
    const out = { pending: 0, approved: 0, rejected: 0 };
    for (const row of signups) {
      const status = row.status || 'pending';
      if (out[status] !== undefined) out[status] += 1;
    }
    return out;
  }, [signups]);

  const rows = useMemo(
    () => (statusFilter ? signups.filter((s) => (s.status || 'pending') === statusFilter) : signups),
    [signups, statusFilter],
  );

  // The full record, loaded when a row is opened — it carries the listing as
  // it stands now, which is usually more than they typed at sign-up.
  const detail = useAsync(
    async () => (reviewing ? api.get(endpoints.signups.get(reviewing.id)) : null),
    [reviewing?.id],
    { initialData: null },
  );

  const decide = async (row, status, notes) => {
    // Approving publishes a listing to the directory. Worth a beat.
    if (status === 'approved') {
      const ok = await confirm({
        title: 'Approve and publish',
        message: `${row.submitted_name} goes live on Gulf Coast Radar. You can reverse this.`,
        confirmLabel: 'Approve',
      });
      if (!ok) return;
    }
    try {
      await api.patch(endpoints.signups.update(row.id), { status, ...(notes ? { notes } : {}) });
      toast.success(status === 'approved' ? `${row.submitted_name} is live.` : `Sign-up ${status}.`);
      setReviewing(null);
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  const openEntity = (slug) => navigate(`/directory/entity/${encodeURIComponent(slug)}`);

  const tableColumns = [
    {
      key: 'submitted_name',
      header: 'Business',
      render: (row) => (
        <div>
          <div className="ui-cell-primary">{row.submitted_name}</div>
          <div className="ui-cell-sub mono">{row.entity_slug || '—'}</div>
        </div>
      ),
    },
    columns.text('phone', 'Phone'),
    {
      key: 'duplicate_count',
      header: 'Similar',
      align: 'right',
      render: (row) =>
        row.duplicate_count > 0 ? (
          <Badge tone="warning">{row.duplicate_count}</Badge>
        ) : (
          <span className="faint">—</span>
        ),
    },
    columns.status('status', 'Status', STATUS_TONES),
    columns.dateTime('created_at', 'Signed up'),
    {
      key: '__actions',
      header: '',
      align: 'right',
      sortable: false,
      searchable: false,
      stopPropagation: true,
      render: (row) => (
        <span className="ui-cell-actions">
          {(row.status || 'pending') === 'pending' && (
            <>
              <Button size="sm" variant="success" onClick={() => decide(row, 'approved')}>Approve</Button>
              <Button size="sm" variant="danger" onClick={() => decide(row, 'rejected')}>Reject</Button>
            </>
          )}
          <Button size="sm" onClick={() => setReviewing(row)}>Review</Button>
        </span>
      ),
    },
  ];

  const full = detail.data?.signup || reviewing;
  const entity = detail.data?.entity || null;

  return (
    <>
      <PageHeader
        title="Business sign-ups"
        description="Businesses that added themselves. Hidden from the public site until approved."
        actions={<Button onClick={reload} disabled={loading}>Refresh</Button>}
      />

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="Waiting" value={counts.pending} tone={counts.pending ? 'warning' : 'neutral'} />
        <Stat label="Approved" value={counts.approved} tone="success" />
        <Stat label="Rejected" value={counts.rejected} />
      </div>

      <Card padded={false}>
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <DataTable
            columns={tableColumns}
            rows={rows}
            loading={loading}
            error={error}
            onRetry={reload}
            searchPlaceholder="Search sign-ups…"
            emptyTitle="Nothing waiting"
            emptyDescription="No business has signed itself up yet."
            initialSort={{ key: 'created_at', direction: 'desc' }}
            onRowClick={(row) => setReviewing(row)}
            toolbar={
              <select
                className="ui-input ui-input--select"
                style={{ width: 'auto' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="pending">Waiting</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="">All</option>
              </select>
            }
          />
        </div>
      </Card>

      <Modal
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        size="lg"
        title={full ? full.submitted_name : ''}
        description={full?.entity_slug || undefined}
      >
        {full && (
          <div className="stack">
            {full.duplicate_count > 0 || full.possible_duplicates?.length ? (
              <Notice tone="warning" title="This name resembles listings already on GCR">
                Check these before approving — a business that already exists should be
                claiming its listing, not creating a second one.
              </Notice>
            ) : null}

            <dl className="stack-sm">
              {[
                ['Phone', full.phone],
                ['Phone verified', full.phone_verified_at ? 'Yes' : 'No'],
                ['Email', full.email],
                ['Website', full.website],
                ['Listing', entity ? `${entity.name} · ${entity.city || 'no city'}` : null],
                ['Type', entity?.entity_type],
                ['Public now', entity ? (entity.is_active ? 'Yes' : 'No') : null],
                ['Reviewed by', full.reviewed_by],
                ['Notes', full.notes],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="ui-field__label">{label}</dt>
                    <dd style={{ margin: 0 }}>{value}</dd>
                  </div>
                ))}
            </dl>

            <div>
              <div className="ui-field__label">Similar listings</div>
              <Duplicates matches={full.possible_duplicates} onOpen={openEntity} />
            </div>

            {full.entity_slug && (
              <Button onClick={() => openEntity(full.entity_slug)}>Open this listing</Button>
            )}

            <SchemaForm
              schema={decisionSchema}
              initialValues={{ status: full.status || 'pending', notes: full.notes || '' }}
              columns={1}
              onSubmit={(values) => decide(full, values.status, values.notes)}
              onCancel={() => setReviewing(null)}
              submitLabel="Save decision"
            />
          </div>
        )}
      </Modal>

      {confirmElement}
    </>
  );
}
