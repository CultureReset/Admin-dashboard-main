/**
 * Bookings taken across the platform.
 *
 * GET /api/bookings — mounted at its own prefix, not under /api/admin.
 * (The legacy dashboard called /api/admin/bookings, which does not exist.)
 */

import { useMemo, useState } from 'react';
import { Button, Card, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, formatMoney } from '../../lib/fields.jsx';

const STATUS_TONES = {
  confirmed: 'success',
  pending: 'warning',
  cancelled: 'danger',
  completed: 'info',
  refunded: 'neutral',
};

export default function Bookings() {
  const [statusFilter, setStatusFilter] = useState('');

  const { data, loading, error, reload } = useAsync(
    async () => unwrapList(await api.get(endpoints.bookings.list()), ['bookings']),
    [],
    { initialData: [] },
  );

  const bookings = data || [];

  const statuses = useMemo(() => {
    const seen = new Set();
    for (const booking of bookings) if (booking.status) seen.add(booking.status);
    return [...seen].sort();
  }, [bookings]);

  const rows = useMemo(
    () => (statusFilter ? bookings.filter((b) => b.status === statusFilter) : bookings),
    [bookings, statusFilter],
  );

  const revenue = bookings
    .filter((b) => !['cancelled', 'refunded'].includes(b.status))
    .reduce((sum, b) => sum + Number(b.total || b.amount || 0), 0);

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Reservations and purchases taken through the platform."
        actions={<Button onClick={reload} disabled={loading}>Refresh</Button>}
      />

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="Bookings" value={bookings.length} tone="primary" />
        <Stat
          label="Confirmed"
          value={bookings.filter((b) => b.status === 'confirmed').length}
          tone="success"
        />
        <Stat
          label="Pending"
          value={bookings.filter((b) => b.status === 'pending').length}
          tone="warning"
        />
        <Stat label="Gross value" value={formatMoney(revenue)} hint="Excludes cancelled and refunded" />
      </div>

      <Card padded={false}>
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <DataTable
            columns={[
              columns.primary('customer_name', 'Customer', 'customer_email'),
              columns.text('entity_slug', 'Business'),
              columns.text('service_name', 'Service'),
              columns.dateTime('booking_date', 'When'),
              columns.number('party_size', 'Party'),
              {
                key: 'total',
                header: 'Total',
                align: 'right',
                render: (row) => formatMoney(row.total ?? row.amount) || <span className="faint">—</span>,
              },
              columns.status('status', 'Status', STATUS_TONES),
              columns.dateTime('created_at', 'Booked'),
            ]}
            rows={rows}
            loading={loading}
            error={error}
            onRetry={reload}
            searchPlaceholder="Search bookings…"
            emptyTitle="No bookings"
            initialSort={{ key: 'created_at', direction: 'desc' }}
            toolbar={
              statuses.length > 0 && (
                <select
                  className="ui-input ui-input--select"
                  style={{ width: 'auto' }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All statuses</option>
                  {statuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              )
            }
          />
        </div>
      </Card>
    </>
  );
}
