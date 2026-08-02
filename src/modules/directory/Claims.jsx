/**
 * Business claim requests.
 *
 * GET   /api/admin/gcr/claims
 * PATCH /api/admin/gcr/claims/:id  { status, notes }
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, fields, CLAIM_STATUSES } from '../../lib/fields.jsx';

const STATUS_TONES = { pending: 'warning', approved: 'success', rejected: 'danger' };

const decisionSchema = [
  fields.select('status', 'Decision', CLAIM_STATUSES, { required: true, span: 'full' }),
  fields.textarea('notes', 'Notes', { rows: 4, help: 'Recorded against the claim.' }),
];

export default function Claims() {
  const toast = useToast();
  const navigate = useNavigate();
  const [deciding, setDeciding] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, loading, error, reload } = useAsync(
    async () => unwrapList(await api.get(endpoints.claims.list()), ['claims']),
    [],
    { initialData: [] },
  );

  const claims = data || [];

  const counts = useMemo(() => {
    const out = { pending: 0, approved: 0, rejected: 0 };
    for (const claim of claims) {
      const status = claim.status || 'pending';
      if (out[status] !== undefined) out[status] += 1;
    }
    return out;
  }, [claims]);

  const rows = useMemo(
    () => (statusFilter ? claims.filter((c) => (c.status || 'pending') === statusFilter) : claims),
    [claims, statusFilter],
  );

  const decide = async (values) => {
    await api.patch(endpoints.claims.update(deciding.id), values);
    toast.success(`Claim ${values.status}.`);
    setDeciding(null);
    await reload();
  };

  const quickDecide = async (claim, status) => {
    try {
      await api.patch(endpoints.claims.update(claim.id), { status });
      toast.success(`Claim ${status}.`);
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  const tableColumns = [
    columns.primary('business_name', 'Business', 'entity_slug'),
    columns.text('contact_name', 'Contact'),
    columns.text('email', 'Email'),
    columns.text('phone', 'Phone'),
    columns.status('status', 'Status', STATUS_TONES),
    columns.dateTime('created_at', 'Submitted'),
    {
      key: '__actions',
      header: '',
      align: 'right',
      sortable: false,
      searchable: false,
      stopPropagation: true,
      render: (row) => (
        <span className="ui-cell-actions">
          {row.entity_slug && (
            <Button
              size="sm"
              onClick={() => navigate(`/directory/entity/${encodeURIComponent(row.entity_slug)}`)}
            >
              Open
            </Button>
          )}
          {(row.status || 'pending') === 'pending' && (
            <>
              <Button size="sm" variant="success" onClick={() => quickDecide(row, 'approved')}>
                Approve
              </Button>
              <Button size="sm" variant="danger" onClick={() => quickDecide(row, 'rejected')}>
                Reject
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => setDeciding(row)}>Review</Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Business claims"
        description="Owners asking for control of their GCR listing."
        actions={<Button onClick={reload} disabled={loading}>Refresh</Button>}
      />

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="Pending" value={counts.pending} tone={counts.pending ? 'warning' : 'neutral'} />
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
            searchPlaceholder="Search claims…"
            emptyTitle="No claims"
            emptyDescription="No one has asked to claim a listing yet."
            initialSort={{ key: 'created_at', direction: 'desc' }}
            toolbar={
              <select
                className="ui-input ui-input--select"
                style={{ width: 'auto' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                {CLAIM_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            }
          />
        </div>
      </Card>

      <Modal
        open={Boolean(deciding)}
        onClose={() => setDeciding(null)}
        title="Review claim"
        description={deciding ? `${deciding.business_name || deciding.entity_slug}` : undefined}
      >
        {deciding && (
          <div className="stack">
            <dl className="stack-sm">
              {[
                ['Contact', deciding.contact_name],
                ['Email', deciding.email],
                ['Phone', deciding.phone],
                ['Role', deciding.role],
                ['Message', deciding.message || deciding.notes],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="ui-field__label">{label}</dt>
                    <dd style={{ margin: 0 }}>{value}</dd>
                  </div>
                ))}
            </dl>
            <SchemaForm
              schema={decisionSchema}
              initialValues={{ status: deciding.status || 'pending', notes: deciding.notes || '' }}
              columns={1}
              onSubmit={decide}
              onCancel={() => setDeciding(null)}
              submitLabel="Save decision"
            />
          </div>
        )}
      </Modal>
    </>
  );
}
