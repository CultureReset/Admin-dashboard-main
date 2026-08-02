/**
 * Bookings and availability.
 *
 * There is no cross-business booking list in the API. `routes/bookings.js` is
 * slug-scoped and is really an availability calendar over `entity_availability`;
 * the rentals and services apps keep their own `booking_events` table; and the
 * canonical `offerings`/`bookings` engine in `routes/platform.js` is
 * owner-scoped, so an admin token cannot reach it.
 *
 * This screen shows what is genuinely reachable today:
 *   GET /api/bookings/:slug/date-range   availability across a range
 *   GET /api/rentals/:slug/bookings      resource bookings, if the business uses rentals
 *   GET /api/services/:slug/bookings     resource bookings, if it uses services
 *
 * A true admin booking ledger needs an admin-scoped route over the platform
 * engine. That is tracked and not faked here.
 */

import { useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useAsync, usePersistentState } from '../../hooks/useAsync.js';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, formatDate, formatMoney } from '../../lib/fields.jsx';

/** Default to the coming month — the range the API requires. */
function defaultRange() {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 30);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default function Bookings() {
  const [slug, setSlug] = usePersistentState('cc_admin_entity', null);
  const [range, setRange] = useState(defaultRange);

  const availabilityQuery = useAsync(
    async () => {
      if (!slug) return [];
      const payload = await api.get(endpoints.bookings.dateRange(slug), {
        auth: false,
        query: { start_date: range.start, end_date: range.end },
      });
      return unwrapList(payload, ['availability']);
    },
    [slug, range.start, range.end],
    { initialData: [] },
  );

  // Resource bookings only exist if the business is set up as a rental or
  // service. A 404 here means "not that kind of business", not a failure.
  const resourceQuery = useAsync(
    async () => {
      if (!slug) return { rentals: [], services: [] };
      const settle = async (path) => {
        try {
          return unwrapList(await api.get(path), ['bookings']);
        } catch {
          return [];
        }
      };
      const [rentals, services] = await Promise.all([
        settle(endpoints.bookings.rentalBookings(slug)),
        settle(endpoints.bookings.serviceBookings(slug)),
      ]);
      return { rentals, services };
    },
    [slug],
    { initialData: { rentals: [], services: [] } },
  );

  const availability = availabilityQuery.data || [];
  const resourceBookings = useMemo(() => {
    const { rentals = [], services = [] } = resourceQuery.data || {};
    return [
      ...rentals.map((b) => ({ ...b, __source: 'rental' })),
      ...services.map((b) => ({ ...b, __source: 'service' })),
    ];
  }, [resourceQuery.data]);

  const totals = useMemo(() => {
    const days = availability.length;
    const blocked = availability.filter((d) => d.blocked).length;
    const booked = availability.reduce((n, d) => n + Number(d.booked_slots || 0), 0);
    const capacity = availability.reduce((n, d) => n + Number(d.available_slots || 0), 0);
    return { days, blocked, booked, capacity };
  }, [availability]);

  const refresh = () => {
    availabilityQuery.reload();
    resourceQuery.reload();
  };

  return (
    <>
      <PageHeader
        title="Bookings & availability"
        description="Availability and resource bookings for one business."
        actions={slug && <Button onClick={refresh} disabled={availabilityQuery.loading}>Refresh</Button>}
      />

      <Notice tone="warning" title="There is no cross-business booking ledger in the API">
        <p>
          Bookings live in three parallel models in <code>gcr-api-clean</code>:{' '}
          <code className="mono">entity_availability</code>,{' '}
          <code className="mono">booking_events</code> (rentals and services), and the canonical{' '}
          <code className="mono">offerings</code>/<code className="mono">bookings</code> engine in{' '}
          <code className="mono">routes/platform.js</code>. Only the third is the declared model,
          and it is owner-scoped — an admin token cannot read it.
        </p>
        <p style={{ marginTop: 8 }}>
          This screen shows what is reachable today. A real admin booking ledger needs an
          admin-scoped route over the platform engine.
        </p>
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <Card title="Business">
        <div className="row-wrap" style={{ alignItems: 'flex-end' }}>
          <EntityPicker value={slug} onChange={setSlug} label="Show bookings for" />
          <div className="ui-field" style={{ maxWidth: 170 }}>
            <label className="ui-field__label" htmlFor="range-start">From</label>
            <input
              id="range-start"
              className="ui-input"
              type="date"
              value={range.start}
              onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
            />
          </div>
          <div className="ui-field" style={{ maxWidth: 170 }}>
            <label className="ui-field__label" htmlFor="range-end">To</label>
            <input
              id="range-end"
              className="ui-input"
              type="date"
              value={range.end}
              onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
            />
          </div>
        </div>
      </Card>

      {!slug && (
        <>
          <div style={{ height: 'var(--space-4)' }} />
          <div className="entity-picker__prompt">Pick a business to see its availability.</div>
        </>
      )}

      {slug && (
        <>
          <div className="grid-auto" style={{ margin: 'var(--space-5) 0' }}>
            <Stat label="Days with a record" value={totals.days} tone="primary" />
            <Stat label="Blocked days" value={totals.blocked} tone={totals.blocked ? 'warning' : 'neutral'} />
            <Stat label="Slots booked" value={totals.booked} tone="success" />
            <Stat label="Slots offered" value={totals.capacity} />
            <Stat label="Resource bookings" value={resourceBookings.length} />
          </div>

          <div className="stack">
            <Card padded={false} title="Availability">
              <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
                {availabilityQuery.loading && <LoadingBlock />}
                {availabilityQuery.error && (
                  <ErrorState error={availabilityQuery.error} onRetry={availabilityQuery.reload} />
                )}
                {!availabilityQuery.loading && !availabilityQuery.error && availability.length === 0 && (
                  <EmptyState
                    icon="📅"
                    title="No availability records"
                    description="This business has no rows in entity_availability for the chosen range."
                  />
                )}
                {!availabilityQuery.loading && !availabilityQuery.error && availability.length > 0 && (
                  <DataTable
                    columns={[
                      {
                        key: 'available_date',
                        header: 'Date',
                        render: (row) => formatDate(row.available_date),
                      },
                      columns.number('available_slots', 'Slots'),
                      columns.number('booked_slots', 'Booked'),
                      {
                        key: '__left',
                        header: 'Remaining',
                        align: 'right',
                        value: (row) => Number(row.available_slots || 0) - Number(row.booked_slots || 0),
                        render: (row) => {
                          const left = Number(row.available_slots || 0) - Number(row.booked_slots || 0);
                          return (
                            <Badge tone={left <= 0 ? 'danger' : left <= 2 ? 'warning' : 'success'}>
                              {left}
                            </Badge>
                          );
                        },
                      },
                      {
                        key: 'blocked',
                        header: 'Status',
                        render: (row) =>
                          row.blocked ? <Badge tone="danger">Blocked</Badge> : <Badge tone="success">Open</Badge>,
                      },
                      {
                        key: 'special_pricing',
                        header: 'Special price',
                        align: 'right',
                        render: (row) =>
                          row.special_pricing ? formatMoney(row.special_pricing) : <span className="faint">—</span>,
                      },
                    ]}
                    rows={availability}
                    rowKey={(row, index) => row.id ?? row.available_date ?? index}
                    searchPlaceholder="Search dates…"
                    initialSort={{ key: 'available_date', direction: 'asc' }}
                  />
                )}
              </div>
            </Card>

            <Card padded={false} title="Resource bookings">
              <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
                {resourceQuery.loading && <LoadingBlock />}
                {!resourceQuery.loading && resourceBookings.length === 0 && (
                  <EmptyState
                    icon="🛥️"
                    title="No resource bookings"
                    description="This business is not set up as a rental or service, or has no bookings."
                  />
                )}
                {!resourceQuery.loading && resourceBookings.length > 0 && (
                  <DataTable
                    columns={[
                      {
                        key: '__source',
                        header: 'Type',
                        render: (row) => <Badge tone="info">{row.__source}</Badge>,
                      },
                      columns.primary('guest_name', 'Guest', 'guest_email'),
                      columns.date('check_in_date', 'Check in'),
                      columns.date('check_out_date', 'Check out'),
                      columns.number('guests', 'Guests'),
                      {
                        key: 'total_price',
                        header: 'Total',
                        align: 'right',
                        render: (row) =>
                          formatMoney(row.total_price ?? row.total) || <span className="faint">—</span>,
                      },
                      columns.status('status', 'Status', {
                        confirmed: 'success',
                        pending: 'warning',
                        cancelled: 'danger',
                      }),
                    ]}
                    rows={resourceBookings}
                    rowKey={(row, index) => row.id ?? index}
                    searchPlaceholder="Search bookings…"
                    initialSort={{ key: 'check_in_date', direction: 'desc' }}
                  />
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
