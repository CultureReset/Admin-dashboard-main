/**
 * Availability — capacity minus what has been booked, per business per date.
 *
 * `business_availability` is where the two halves of the pipeline meet. Three
 * things write to it and this is the only place all three are visible at once:
 *
 *   the email parser   subtracts a party size on every confirmation it reads
 *   the iCal import    hard-blocks any date an external feed claims
 *   an admin           hand-edits a row when a phone booking comes in
 *
 * `source_platform` says which. A row with `total_capacity` null is a business
 * with no capacity on file — the parser logged the booking but had nothing to
 * subtract from, so `remaining_spots` is null and the date can't be marketed.
 * Fix those in Inventory & capacity.
 *
 * GET/PUT /api/admin/platform/availability
 * DELETE  /api/admin/platform/availability/:id
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, ErrorState, LoadingBlock, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Modal, useConfirm } from '../../ui/Modal.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { AVAILABILITY_STATUSES, AVAILABILITY_STATUS_TONES } from '../../api/bookingResources.js';
import { fields, formatDateTime } from '../../lib/fields.jsx';

/** Today, and today + n days, both as YYYY-MM-DD in local time. */
function isoDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const rowSchema = {
  groups: [
    {
      title: 'When',
      fields: [
        fields.date('availability_date', 'Date', { required: true }),
        fields.text('time_slot', 'Time slot', {
          placeholder: '00:00',
          help: 'One row per departure. Use 00:00 for businesses with a single daily count.',
        }),
      ],
    },
    {
      title: 'Numbers',
      fields: [
        fields.number('total_capacity', 'Total capacity', { min: 0, step: 1 }),
        fields.number('booked_count', 'Booked', { min: 0, step: 1 }),
        fields.number('remaining_spots', 'Remaining', {
          min: 0,
          step: 1,
          help: 'Leave blank to have it computed from capacity minus booked.',
        }),
        fields.select('status', 'Status', AVAILABILITY_STATUSES, {
          help: 'Leave blank to derive it from the remaining count.',
        }),
      ],
    },
    {
      title: 'Visibility',
      fields: [
        fields.bool('visible_on_profile', 'Show on the public profile', { defaultValue: true }),
        fields.text('source_platform', 'Source', {
          help: 'Left blank for hand-entered rows, which is how the parser tells its own rows apart.',
        }),
      ],
    },
  ],
};

export default function Availability() {
  const toast = useToast();
  const [slug, setSlug] = useState(null);
  const [from, setFrom] = useState(() => isoDay(0));
  const [to, setTo] = useState(() => isoDay(30));
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(null);
  const [confirm, confirmElement] = useConfirm();

  const query = useAsync(
    async () =>
      unwrapList(
        await api.get(endpoints.bookingPlatform.availability(), {
          query: {
            slug: slug || undefined,
            from: from || undefined,
            to: to || undefined,
            status: status || undefined,
            limit: 1000,
          },
        }),
        ['availability'],
      ),
    [slug, from, to, status],
    { initialData: [] },
  );

  const rows = query.data || [];

  const stats = useMemo(() => {
    let open = 0;
    let full = 0;
    let unknown = 0;
    let spots = 0;
    for (const r of rows) {
      if (r.total_capacity == null) unknown += 1;
      if (r.remaining_spots > 0) {
        open += 1;
        spots += Number(r.remaining_spots) || 0;
      }
      if (r.status === 'full' || r.status === 'blocked') full += 1;
    }
    return { open, full, unknown, spots };
  }, [rows]);

  const save = async (values) => {
    await api.put(endpoints.bookingPlatform.availability(), {
      ...values,
      entity_slug: editing.entity_slug,
      resource_id: editing.resource_id ?? undefined,
      // Blank means "derive it"; the API only computes when it's undefined.
      remaining_spots: values.remaining_spots === '' ? undefined : values.remaining_spots,
      status: values.status || undefined,
    });
    toast.success('Availability saved.');
    setEditing(null);
    query.reload();
  };

  const remove = async (row) => {
    const ok = await confirm({
      title: 'Delete availability row',
      message: `Delete the ${row.availability_date} row for ${row.entity_name || row.entity_slug}? The bookings behind it are not deleted — the count is just forgotten.`,
      confirmLabel: 'Delete row',
    });
    if (!ok) return;
    try {
      await api.del(endpoints.bookingPlatform.availabilityRow(row.id));
      toast.success('Row deleted.');
      query.reload();
    } catch (err) {
      toast.error(err.message, 'Could not delete');
    }
  };

  return (
    <>
      <PageHeader
        title="Availability"
        description="What is left, per business per date, from every source that claims a date."
        actions={<Button onClick={query.reload} disabled={query.loading}>Refresh</Button>}
      />

      <Notice tone="info" title="Three writers, one table">
        <p>
          Parsed confirmation emails, external{' '}
          <Link to="/booking/feeds">iCal feeds</Link>, and hand edits all land here.{' '}
          <span className="mono">source</span> on each row says which. Rows with no capacity
          come from businesses that have none on file — set it in{' '}
          <Link to="/booking/inventory">Inventory &amp; capacity</Link>.
        </p>
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <Card>
        <div className="row-wrap" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
          <div style={{ minWidth: 210, flex: 1, maxWidth: 290 }}>
            <EntityPicker value={slug} onChange={setSlug} label={null} placeholder="All businesses…" />
          </div>
          <input
            className="ui-input"
            type="date"
            style={{ width: 'auto' }}
            value={from}
            aria-label="From date"
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            className="ui-input"
            type="date"
            style={{ width: 'auto' }}
            value={to}
            aria-label="To date"
            onChange={(e) => setTo(e.target.value)}
          />
          <select
            className="ui-input ui-input--select"
            style={{ width: 'auto' }}
            value={status}
            aria-label="Status"
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Any status</option>
            {AVAILABILITY_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </Card>

      <div style={{ height: 'var(--space-4)' }} />

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="Rows in range" value={rows.length} />
        <Stat label="Dates with spots" value={stats.open} tone={stats.open ? 'success' : 'neutral'} />
        <Stat label="Spots open" value={stats.spots} tone="primary" />
        <Stat label="Full or blocked" value={stats.full} />
        <Stat
          label="No capacity"
          value={stats.unknown}
          tone={stats.unknown ? 'warning' : 'neutral'}
          hint="Cannot compute what's left"
        />
      </div>

      {query.loading && <LoadingBlock />}
      {query.error && <ErrorState error={query.error} onRetry={query.reload} />}

      {!query.loading && !query.error && (
        <Card padded={false}>
          <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
            <DataTable
              columns={[
                {
                  key: 'availability_date',
                  header: 'Date',
                  render: (row) => (
                    <div>
                      <div className="ui-cell-primary">{row.availability_date}</div>
                      {row.time_slot && row.time_slot !== '00:00' && (
                        <div className="ui-cell-sub">{row.time_slot}</div>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'entity_name',
                  header: 'Business',
                  value: (row) => row.entity_name || row.entity_slug,
                  render: (row) => (
                    <Link to={`/directory/entity/${encodeURIComponent(row.entity_slug)}`}>
                      {row.entity_name || row.entity_slug}
                    </Link>
                  ),
                },
                {
                  key: 'remaining_spots',
                  header: 'Left',
                  align: 'right',
                  render: (row) =>
                    row.remaining_spots == null ? (
                      <span className="faint">—</span>
                    ) : (
                      <Badge
                        tone={
                          row.remaining_spots === 0
                            ? 'danger'
                            : row.remaining_spots <= 3
                              ? 'warning'
                              : 'success'
                        }
                      >
                        {row.remaining_spots}
                      </Badge>
                    ),
                },
                {
                  key: 'booked_count',
                  header: 'Booked / capacity',
                  align: 'right',
                  value: (row) => row.booked_count ?? 0,
                  render: (row) =>
                    row.total_capacity == null ? (
                      <span title="No capacity on file for this business">
                        {row.booked_count ?? 0} / <Badge tone="warning">?</Badge>
                      </span>
                    ) : (
                      `${row.booked_count ?? 0} / ${row.total_capacity}`
                    ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) => (
                    <Badge tone={AVAILABILITY_STATUS_TONES[row.status] || 'neutral'}>
                      {row.status || 'unknown'}
                    </Badge>
                  ),
                },
                {
                  key: 'source_platform',
                  header: 'Written by',
                  render: (row) =>
                    row.source_platform ? (
                      <span className="mono">{row.source_platform}</span>
                    ) : (
                      <span className="faint">manual</span>
                    ),
                },
                {
                  key: 'last_updated',
                  header: 'Updated',
                  render: (row) => formatDateTime(row.last_updated) || <span className="faint">—</span>,
                },
                {
                  key: '__actions',
                  header: '',
                  align: 'right',
                  sortable: false,
                  searchable: false,
                  stopPropagation: true,
                  render: (row) => (
                    <span className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <Button size="sm" onClick={() => setEditing(row)}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => remove(row)}>Delete</Button>
                    </span>
                  ),
                },
              ]}
              rows={rows}
              rowKey={(row, i) => row.id ?? i}
              searchPlaceholder="Search businesses…"
              emptyTitle="No availability rows"
              emptyDescription="Nothing has claimed a date in this range yet."
              initialSort={{ key: 'availability_date', direction: 'asc' }}
            />
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        size="lg"
        title={editing ? `Availability — ${editing.entity_name || editing.entity_slug}` : ''}
        description={editing ? `${editing.availability_date} · ${editing.time_slot || '00:00'}` : ''}
      >
        {editing && (
          <SchemaForm
            schema={rowSchema}
            initialValues={{
              availability_date: editing.availability_date,
              time_slot: editing.time_slot || '00:00',
              total_capacity: editing.total_capacity ?? '',
              booked_count: editing.booked_count ?? '',
              remaining_spots: editing.remaining_spots ?? '',
              status: editing.status || '',
              visible_on_profile: editing.visible_on_profile !== false,
              source_platform: editing.source_platform || '',
            }}
            submitLabel="Save row"
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      {confirmElement}
    </>
  );
}
