/**
 * Bookings — the ledger across every business.
 *
 * `bookings` is the one table every booking-type app writes to; the unit
 * (person, hour, day, night, ticket) is data on the row rather than a separate
 * table. This is the operator view of it.
 *
 * GET/POST /api/admin/platform/bookings
 * PATCH/DELETE /api/admin/platform/bookings/:id
 */

import { useMemo, useState } from 'react';
import { Badge, Button, Card, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { Modal, useConfirm } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync, useDebounced } from '../../hooks/useAsync.js';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { BOOKING_STATUSES, BOOKING_STATUS_TONES } from '../../api/bookingResources.js';
import { columns, fields, formatDate, formatMoney } from '../../lib/fields.jsx';

const bookingSchema = {
  groups: [
    {
      title: 'Guest',
      fields: [
        fields.text('customer_name', 'Name', { required: true, span: 2 }),
        fields.email('email', 'Email'),
        fields.tel('phone', 'Phone'),
      ],
    },
    {
      title: 'When',
      fields: [
        fields.date('date', 'Date', { required: true }),
        fields.date('end_date', 'End date', { help: 'For multi-night or multi-day bookings.' }),
        fields.time('start_time', 'Start time'),
      ],
    },
    {
      title: 'Party',
      fields: [
        fields.number('party_size', 'Party size', { min: 0, step: 1 }),
        fields.number('adults', 'Adults', { min: 0, step: 1 }),
        fields.number('children', 'Children', { min: 0, step: 1 }),
        fields.number('qty', 'Quantity', { min: 0, step: 1, help: 'Units booked, for item pricing.' }),
      ],
    },
    {
      title: 'Money & status',
      fields: [
        fields.money('total_price', 'Total'),
        fields.money('deposit_paid', 'Deposit paid'),
        fields.select('status', 'Status', BOOKING_STATUSES, { required: true }),
        fields.text('source', 'Source', { placeholder: 'direct, fareharbor, admin…' }),
      ],
    },
  ],
};

export default function BookingsLedger() {
  const toast = useToast();
  const [slug, setSlug] = useState(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [editing, setEditing] = useState(null);
  const [confirm, confirmElement] = useConfirm();

  const debouncedSearch = useDebounced(search, 350);

  const query = useMemo(
    () => ({
      slug: slug || undefined,
      status: status || undefined,
      q: debouncedSearch || undefined,
      from: range.from || undefined,
      to: range.to || undefined,
      limit: 500,
    }),
    [slug, status, debouncedSearch, range.from, range.to],
  );

  const { data, loading, error, reload } = useAsync(
    async () => unwrapList(await api.get(endpoints.bookingPlatform.bookings(), { query }), ['bookings']),
    [query],
    { initialData: [] },
  );

  const bookings = data || [];

  const stats = useMemo(() => {
    const live = bookings.filter((b) => !['cancelled', 'no_show'].includes(b.status));
    const revenue = live.reduce((sum, b) => sum + Number(b.total_price || 0), 0);
    const deposits = live.reduce((sum, b) => sum + Number(b.deposit_paid || 0), 0);
    const guests = live.reduce((sum, b) => sum + Number(b.party_size || 0), 0);
    return {
      total: bookings.length,
      pending: bookings.filter((b) => b.status === 'pending').length,
      revenue,
      deposits,
      guests,
    };
  }, [bookings]);

  const save = async (values) => {
    if (editing.id) {
      await api.patch(endpoints.bookingPlatform.booking(editing.id), values);
    } else {
      const entitySlug = editing.entity_slug || slug;
      if (!entitySlug) {
        toast.warning('Pick a business first.');
        return;
      }
      await api.post(endpoints.bookingPlatform.bookings(), { ...values, entity_slug: entitySlug });
    }
    toast.success('Booking saved.');
    setEditing(null);
    await reload();
  };

  const setStatusOf = async (row, next) => {
    try {
      await api.patch(endpoints.bookingPlatform.booking(row.id), { status: next });
      toast.success(`Marked ${next}.`);
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  const remove = async (row) => {
    const ok = await confirm({
      title: 'Delete booking',
      message: `Delete ${row.customer_name || 'this booking'} on ${formatDate(row.date)}? Cancelling is usually better than deleting — it keeps the record.`,
      confirmLabel: 'Delete permanently',
    });
    if (!ok) return;
    try {
      await api.del(endpoints.bookingPlatform.booking(row.id));
      toast.success('Booking deleted.', 'Deleted');
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Every booking across every business — charters, cruises, rentals, stays."
        actions={
          <>
            <Button onClick={reload} disabled={loading}>Refresh</Button>
            <Button variant="primary" onClick={() => setEditing({ entity_slug: slug || '' })}>
              Add booking
            </Button>
          </>
        }
      />

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="Bookings" value={loading ? '…' : stats.total} tone="primary" />
        <Stat
          label="Pending"
          value={loading ? '…' : stats.pending}
          tone={stats.pending ? 'warning' : 'neutral'}
        />
        <Stat label="Guests" value={loading ? '…' : stats.guests} />
        <Stat
          label="Booked value"
          value={loading ? '…' : formatMoney(stats.revenue)}
          tone="success"
          hint="Excludes cancelled and no-shows"
        />
        <Stat label="Deposits taken" value={loading ? '…' : formatMoney(stats.deposits)} />
      </div>

      <Card padded={false}>
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <DataTable
            columns={[
              {
                key: 'customer_name',
                header: 'Guest',
                render: (row) => (
                  <div>
                    <div className="ui-cell-primary">
                      {row.customer_name || <span className="faint">no name</span>}
                    </div>
                    <div className="ui-cell-sub">{row.email || row.phone || ''}</div>
                  </div>
                ),
              },
              {
                key: 'entity_name',
                header: 'Business',
                value: (row) => row.entity_name || row.entity_slug,
                render: (row) => row.entity_name || <span className="mono">{row.entity_slug}</span>,
              },
              {
                key: 'date',
                header: 'When',
                render: (row) => (
                  <div>
                    <div>{formatDate(row.date)}</div>
                    {(row.start_time || row.end_date) && (
                      <div className="ui-cell-sub">
                        {[
                          row.start_time?.slice(0, 5),
                          row.end_date && `→ ${formatDate(row.end_date)}`,
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'party_size',
                header: 'Party',
                align: 'right',
                render: (row) => {
                  const parts = [
                    row.adults != null && `${row.adults}a`,
                    row.children != null && `${row.children}c`,
                  ].filter(Boolean);
                  return row.party_size ?? (parts.length ? parts.join(' ') : <span className="faint">—</span>);
                },
              },
              {
                key: 'total_price',
                header: 'Total',
                align: 'right',
                render: (row) => (
                  <div>
                    <div>{formatMoney(row.total_price) || <span className="faint">—</span>}</div>
                    {row.deposit_paid > 0 && (
                      <div className="ui-cell-sub">{formatMoney(row.deposit_paid)} dep.</div>
                    )}
                  </div>
                ),
              },
              columns.status('status', 'Status', BOOKING_STATUS_TONES),
              {
                key: 'source',
                header: 'Source',
                render: (row) =>
                  row.source ? <Badge>{row.source}</Badge> : <span className="faint">—</span>,
              },
              {
                key: '__actions',
                header: '',
                align: 'right',
                sortable: false,
                searchable: false,
                stopPropagation: true,
                render: (row) => (
                  <span className="ui-cell-actions">
                    {row.status === 'pending' && (
                      <Button size="sm" variant="success" onClick={() => setStatusOf(row, 'confirmed')}>
                        Confirm
                      </Button>
                    )}
                    <Button size="sm" onClick={() => setEditing(row)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => remove(row)}>Delete</Button>
                  </span>
                ),
              },
            ]}
            rows={bookings}
            loading={loading}
            error={error}
            onRetry={reload}
            // Search is server-side so it reaches beyond the loaded page.
            externalSearch={search}
            onExternalSearchChange={setSearch}
            searchPlaceholder="Search guests by name, email, or phone…"
            emptyTitle="No bookings"
            emptyDescription="Nothing matches these filters."
            initialSort={{ key: 'date', direction: 'desc' }}
            toolbar={
              <>
                <div style={{ minWidth: 220, flex: 1, maxWidth: 300 }}>
                  <EntityPicker
                    value={slug}
                    onChange={setSlug}
                    label={null}
                    placeholder="All businesses…"
                  />
                </div>
                <select
                  className="ui-input ui-input--select"
                  style={{ width: 'auto' }}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Any status</option>
                  {BOOKING_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <input
                  className="ui-input"
                  type="date"
                  style={{ width: 'auto' }}
                  value={range.from}
                  aria-label="From date"
                  onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                />
                <input
                  className="ui-input"
                  type="date"
                  style={{ width: 'auto' }}
                  value={range.to}
                  aria-label="To date"
                  onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                />
              </>
            }
          />
        </div>
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        size="lg"
        title={editing?.id ? 'Edit booking' : 'Add booking'}
      >
        {editing && (
          <div className="stack">
            {!editing.id && (
              <EntityPicker
                value={editing.entity_slug || slug || null}
                onChange={(next) => setEditing((prev) => ({ ...prev, entity_slug: next }))}
                label="Business"
              />
            )}
            <SchemaForm
              schema={bookingSchema}
              initialValues={{ status: 'pending', source: 'admin', ...editing }}
              onSubmit={save}
              onCancel={() => setEditing(null)}
              submitLabel={editing.id ? 'Save booking' : 'Create booking'}
            />
          </div>
        )}
      </Modal>

      {confirmElement}
    </>
  );
}
