/**
 * Inventory and capacity — what each business actually has.
 *
 * This is the number the whole availability pipeline depends on. A parsed
 * confirmation email tells us a booking happened; it can only tell us how many
 * spots are LEFT if we already know how many there were. That number is
 * `entity.daily_capacity` (with `capacity_per_slot` for businesses that run
 * multiple departures a day).
 *
 * So a business with no capacity on file will happily log bookings forever and
 * never once report an opening. That is the single most consequential blank
 * field in the system, and this screen exists to make it impossible to miss.
 *
 * Alongside it sits the itemised catalog — five pontoons, two charters — which
 * is `offerings`. The two answer different questions and both matter:
 *   daily_capacity   the fast counter the parser subtracts from
 *   offerings        the named things a guest can actually book
 *
 * GET /api/admin/platform/capacity
 * PUT /api/admin/platform/capacity/:slug
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, ErrorState, LoadingBlock, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { TabBar } from '../../ui/Tabs.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { fields, formatNumber } from '../../lib/fields.jsx';

const TABS = [
  { id: 'missing', label: 'No capacity set' },
  { id: 'all', label: 'Every business' },
  { id: 'catalog', label: 'With a catalog' },
];

const capacitySchema = {
  groups: [
    {
      title: 'Capacity the parser counts down from',
      fields: [
        fields.number('daily_capacity', 'Total per day', {
          min: 0,
          step: 1,
          required: true,
          help: 'Seats, rooms, boats — whatever one day of this business holds. Clear it to go back to "unknown".',
        }),
        fields.number('capacity_per_slot', 'Per departure / time slot', {
          min: 0,
          step: 1,
          help: 'Only for businesses that run several departures a day. Leave blank otherwise.',
        }),
      ],
    },
  ],
};

export default function Inventory() {
  const toast = useToast();
  const [tab, setTab] = useState('missing');
  const [editing, setEditing] = useState(null);

  const query = useAsync(
    async () => api.get(endpoints.bookingPlatform.capacity(), { query: { limit: 2000 } }),
    [],
    { initialData: null },
  );

  const businesses = useMemo(
    () => (Array.isArray(query.data?.businesses) ? query.data.businesses : []),
    [query.data],
  );

  const missing = useMemo(() => businesses.filter((b) => !b.capacity_configured), [businesses]);
  const withCatalog = useMemo(() => businesses.filter((b) => b.offerings > 0), [businesses]);

  const rows = tab === 'missing' ? missing : tab === 'catalog' ? withCatalog : businesses;

  // SchemaForm owns its own submitting state and surfaces a thrown error in
  // the form, so this deliberately does not catch.
  const save = async (values) => {
    // Empty means "unknown capacity", which is a real state and not the same
    // as zero — send null so the API clears the column rather than storing 0.
    await api.put(endpoints.bookingPlatform.businessCapacity(editing.entity_slug), {
      daily_capacity:
        values.daily_capacity === '' || values.daily_capacity == null
          ? null
          : Number(values.daily_capacity),
      capacity_per_slot:
        values.capacity_per_slot === '' || values.capacity_per_slot == null
          ? null
          : Number(values.capacity_per_slot),
    });
    toast.success(`Capacity saved for ${editing.entity_name || editing.entity_slug}.`);
    setEditing(null);
    query.reload();
  };

  const totalSeats = businesses.reduce((n, b) => n + (b.daily_capacity || 0), 0);

  return (
    <>
      <PageHeader
        title="Inventory & capacity"
        description="What each business has, and whether the parser can work out what is left."
        actions={<Button onClick={query.reload} disabled={query.loading}>Refresh</Button>}
      />

      <Notice tone="info" title="Capacity is what turns a booking into an opening">
        <p>
          A confirmation email tells us a date was booked. Only capacity tells us how much is
          still free. Without it, <Link to="/booking/openings">Openings</Link> stays empty for
          that business no matter how many emails arrive.
        </p>
        <p style={{ marginTop: 8 }}>
          The named things a guest books — each pontoon, each charter — live in{' '}
          <Link to="/booking/offerings">Offerings</Link>. This page shows both side by side.
        </p>
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      {query.loading && <LoadingBlock />}
      {query.error && <ErrorState error={query.error} onRetry={query.reload} />}

      {!query.loading && !query.error && (
        <>
          <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
            <Stat label="Active businesses" value={businesses.length} />
            <Stat
              label="Capacity on file"
              value={query.data?.configured ?? 0}
              tone={query.data?.configured ? 'success' : 'neutral'}
            />
            <Stat
              label="No capacity set"
              value={missing.length}
              tone={missing.length ? 'warning' : 'success'}
              hint="Cannot report availability"
            />
            <Stat label="With a catalog" value={withCatalog.length} tone="primary" />
            <Stat label="Total daily capacity" value={formatNumber(totalSeats)} />
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <TabBar
              tabs={TABS.map((t) => ({
                ...t,
                badge:
                  t.id === 'missing' ? missing.length : t.id === 'catalog' ? withCatalog.length : businesses.length,
              }))}
              activeId={tab}
              onChange={setTab}
            />
          </div>

          <Card padded={false}>
            <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
              <DataTable
                columns={[
                  {
                    key: 'entity_name',
                    header: 'Business',
                    value: (row) => `${row.entity_name || ''} ${row.entity_slug}`,
                    render: (row) => (
                      <div>
                        <div className="ui-cell-primary">
                          <Link to={`/directory/entity/${encodeURIComponent(row.entity_slug)}`}>
                            {row.entity_name || row.entity_slug}
                          </Link>
                        </div>
                        <div className="ui-cell-sub mono">{row.entity_slug}</div>
                      </div>
                    ),
                  },
                  {
                    key: 'entity_type',
                    header: 'Type',
                    value: (row) => [row.entity_type, row.entity_subtype].filter(Boolean).join(' '),
                    render: (row) => (
                      <div>
                        <div>{row.entity_type || <span className="faint">—</span>}</div>
                        {row.entity_subtype && <div className="ui-cell-sub">{row.entity_subtype}</div>}
                      </div>
                    ),
                  },
                  {
                    key: 'daily_capacity',
                    header: 'Per day',
                    align: 'right',
                    render: (row) =>
                      row.daily_capacity != null ? (
                        formatNumber(row.daily_capacity)
                      ) : (
                        <Badge tone="warning">Not set</Badge>
                      ),
                  },
                  {
                    key: 'capacity_per_slot',
                    header: 'Per slot',
                    align: 'right',
                    render: (row) =>
                      row.capacity_per_slot != null ? row.capacity_per_slot : <span className="faint">—</span>,
                  },
                  {
                    key: 'offerings',
                    header: 'Catalog',
                    align: 'right',
                    searchable: false,
                    render: (row) =>
                      row.offerings ? (
                        <Link to="/booking/offerings" title={`${row.active_offerings} active`}>
                          {row.offerings} item{row.offerings === 1 ? '' : 's'}
                        </Link>
                      ) : (
                        <span className="faint">none</span>
                      ),
                  },
                  {
                    key: 'offering_kinds',
                    header: 'What they have',
                    sortable: false,
                    value: (row) => (row.offering_kinds || []).map((k) => k.kind).join(' '),
                    render: (row) =>
                      (row.offering_kinds || []).length === 0 ? (
                        <span className="faint">—</span>
                      ) : (
                        <span className="row-wrap" style={{ gap: 4 }}>
                          {row.offering_kinds.map((k) => (
                            <Badge key={k.kind} tone="info">
                              {k.kind} · {k.count}
                            </Badge>
                          ))}
                        </span>
                      ),
                  },
                  {
                    key: 'offering_seats',
                    header: 'Catalog seats',
                    align: 'right',
                    render: (row) =>
                      row.offering_seats ? formatNumber(row.offering_seats) : <span className="faint">—</span>,
                  },
                  {
                    key: '__actions',
                    header: '',
                    align: 'right',
                    sortable: false,
                    searchable: false,
                    stopPropagation: true,
                    render: (row) => (
                      <Button size="sm" onClick={() => setEditing(row)}>
                        {row.capacity_configured ? 'Edit' : 'Set capacity'}
                      </Button>
                    ),
                  },
                ]}
                rows={rows}
                rowKey="entity_slug"
                searchPlaceholder="Search businesses…"
                emptyTitle={tab === 'missing' ? 'Every business has capacity set' : 'No businesses'}
                emptyDescription={
                  tab === 'missing'
                    ? 'Availability can be computed everywhere.'
                    : 'Nothing matched this filter.'
                }
              />
            </div>
          </Card>
        </>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        size="md"
        title={editing ? `Capacity — ${editing.entity_name || editing.entity_slug}` : ''}
        description={editing ? `Confirmations arrive at ${editing.bcc_email}` : ''}
      >
        {editing && (
          <SchemaForm
            schema={capacitySchema}
            initialValues={{
              daily_capacity: editing.daily_capacity ?? '',
              capacity_per_slot: editing.capacity_per_slot ?? '',
            }}
            columns={2}
            submitLabel="Save capacity"
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </>
  );
}
