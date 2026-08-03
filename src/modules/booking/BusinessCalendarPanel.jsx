/**
 * One business's availability calendar.
 *
 * Used in two places from one file, on purpose: as the Calendar tab inside the
 * Entity Editor, and as its own page at /booking/calendar/:slug. A business's
 * calendar should be identical whether you got there through its profile or
 * through a link, and keeping it in one component is the only way to be sure
 * of that.
 *
 * What it shows beyond the grid:
 *   - the units, if it is a complex, each with its own month
 *   - the iCal feeds attached to it, because "why is the 14th blocked" is
 *     nearly always "this feed claimed it"
 *   - how much of the month is real rather than inferred from capacity
 *
 * GET /api/admin/platform/business-calendar/:slug?month=YYYY-MM
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, Notice, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { MonthCalendar, MonthNav, thisMonth } from '../../ui/MonthCalendar.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { formatDate, formatDateTime } from '../../lib/fields.jsx';

export default function BusinessCalendarPanel({ slug, showHeader = true }) {
  const [month, setMonth] = useState(thisMonth);
  const [pickedDay, setPickedDay] = useState(null);

  const query = useAsync(
    async () => (slug ? api.get(endpoints.bookingPlatform.businessCalendar(slug), { query: { month } }) : null),
    [slug, month],
    { initialData: null },
  );

  if (!slug) {
    return <EmptyState icon="🗓️" title="No business selected" description="Pick a business to see its calendar." />;
  }
  if (query.loading && !query.data) return <LoadingBlock />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.reload} />;
  if (!query.data) return null;

  const data = query.data;
  const days = Array.isArray(data.days) ? data.days : [];
  const units = Array.isArray(data.units) ? data.units : [];
  const feeds = Array.isArray(data.feeds) ? data.feeds : [];
  const dayCount = days.length || 1;

  return (
    <>
      {showHeader && (
        <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
          <Stat label="Industry" value={data.vertical_label || data.vertical} hint={`counts are ${data.unit_word}`} />
          <Stat
            label="Open this month"
            value={data.open_days ?? 0}
            tone={data.open_days ? 'success' : 'warning'}
            hint={`of ${dayCount} days`}
          />
          <Stat
            label="Days actually claimed"
            value={data.claimed_days ?? 0}
            tone={data.claimed_days ? 'success' : 'warning'}
            hint="the rest is inferred from capacity"
          />
          {units.length > 0 && <Stat label="Units" value={units.length} tone="primary" />}
          <Stat
            label="Daily capacity"
            value={data.entity?.daily_capacity ?? '—'}
            tone={data.capacity_known ? 'neutral' : 'warning'}
          />
        </div>
      )}

      {!data.capacity_known && (
        <>
          <Notice tone="warning" title="No capacity on file">
            Every day nothing has told us about shows as unknown rather than open, because with no
            capacity there is no number to report. Set it in{' '}
            <Link to="/booking/inventory">Inventory &amp; Capacity</Link>.
          </Notice>
          <div style={{ height: 'var(--space-4)' }} />
        </>
      )}

      <Card
        title={data.entity?.entity_name || slug}
        subtitle={[data.entity?.entity_subtype, data.entity?.city].filter(Boolean).join(' · ') || undefined}
        actions={
          <MonthNav month={month} onChange={setMonth}>
            <Button size="sm" onClick={query.reload} loading={query.loading}>Reload</Button>
          </MonthNav>
        }
      >
        <MonthCalendar
          month={month}
          days={days}
          unitWord={data.unit_word}
          onPickDay={setPickedDay}
          selectedDate={pickedDay?.date}
        />
      </Card>

      {pickedDay && (
        <>
          <div style={{ height: 'var(--space-4)' }} />
          <Card
            title={formatDate(pickedDay.date)}
            actions={<Button size="sm" onClick={() => setPickedDay(null)}>Close</Button>}
          >
            <div className="row-wrap" style={{ gap: 'var(--space-4)' }}>
              <Badge tone={pickedDay.status === 'available' ? 'success' : pickedDay.status === 'limited' ? 'warning' : pickedDay.status === 'full' ? 'danger' : 'neutral'}>
                {pickedDay.status}
              </Badge>
              {pickedDay.remaining != null && (
                <span>
                  <strong>{pickedDay.remaining}</strong>
                  {pickedDay.total != null ? ` of ${pickedDay.total}` : ''} {data.unit_word} left
                </span>
              )}
              {pickedDay.assumed ? (
                <span className="muted">Nothing has claimed this date — open because capacity says so.</span>
              ) : (
                <span className="muted">
                  From {(pickedDay.sources || []).join(', ') || 'a claimed row'}
                  {pickedDay.blocked_by ? ` · blocked by ${pickedDay.blocked_by}` : ''}
                </span>
              )}
            </div>

            {Array.isArray(pickedDay.slots) && pickedDay.slots.length > 0 && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <DataTable
                  columns={[
                    { key: 'time', header: 'Departure' },
                    { key: 'end_time', header: 'Ends', render: (s) => s.end_time || <span className="faint">—</span> },
                    { key: 'remaining', header: 'Left', align: 'right' },
                    { key: 'total', header: 'Capacity', align: 'right' },
                  ]}
                  rows={pickedDay.slots}
                  rowKey={(s, i) => `${s.time}-${i}`}
                  dense
                />
              </div>
            )}

            {Array.isArray(pickedDay.units) && pickedDay.units.length > 0 && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <p className="muted" style={{ marginBottom: 6 }}>Free that day:</p>
                <div className="row-wrap" style={{ gap: 6 }}>
                  {pickedDay.units.map((u) => (
                    <Link key={u.entity_slug} to={`/booking/calendar/${encodeURIComponent(u.entity_slug)}`}>
                      <Badge tone="success">{u.entity_name}</Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {units.length > 0 && (
        <>
          <div style={{ height: 'var(--space-5)' }} />
          <Card
            padded={false}
            title="Units"
            subtitle="Each unit's own month. A unit is where the inventory actually lives."
          >
            <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
              <DataTable
                columns={[
                  {
                    key: 'entity_name',
                    header: 'Unit',
                    render: (u) => (
                      <Link to={`/booking/calendar/${encodeURIComponent(u.entity_slug)}`}>
                        {u.entity_name || u.entity_slug}
                      </Link>
                    ),
                  },
                  {
                    key: 'open_days',
                    header: 'Open',
                    align: 'right',
                    render: (u) => (
                      <Badge tone={u.open_days ? 'success' : 'danger'}>
                        {u.open_days} / {dayCount}
                      </Badge>
                    ),
                  },
                  {
                    key: 'claimed_days',
                    header: 'Claimed',
                    align: 'right',
                    render: (u) =>
                      u.claimed_days ? u.claimed_days : <Badge tone="warning">none</Badge>,
                  },
                  {
                    key: 'strip',
                    header: 'Month',
                    sortable: false,
                    searchable: false,
                    // A 7-column grid squeezed into a phone-width table cell is
                    // unreadable; the open/claimed counts beside it carry the
                    // same information in words.
                    hideOn: 'narrow',
                    render: (u) => (
                      <div style={{ maxWidth: 250 }}>
                        <MonthCalendar month={month} days={u.days || []} unitWord={data.unit_word} compact />
                      </div>
                    ),
                  },
                ]}
                rows={units}
                rowKey="entity_slug"
                searchPlaceholder="Search units…"
              />
            </div>
          </Card>
        </>
      )}

      <div style={{ height: 'var(--space-5)' }} />

      <Card
        title="Where these dates come from"
        subtitle="Forwarded confirmation emails, connected iCal feeds, and hand edits."
      >
        <p className="muted">
          Confirmations arrive at <code className="mono">{data.bcc_email}</code>.{' '}
          <Link to="/booking/sources">See what has actually landed</Link>.
        </p>
        {feeds.length === 0 ? (
          <p className="muted" style={{ marginTop: 'var(--space-3)' }}>
            No external calendar connected. <Link to="/booking/feeds">Add an iCal feed</Link> to pull
            Airbnb or VRBO dates in too.
          </p>
        ) : (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <DataTable
              columns={[
                { key: 'source_label', header: 'Feed', render: (f) => f.source_label || 'External calendar' },
                {
                  key: 'provider',
                  header: 'Provider',
                  render: (f) => (f.provider ? <Badge tone="info">{f.provider}</Badge> : <span className="faint">—</span>),
                },
                {
                  key: 'resource_id',
                  header: 'Scope',
                  render: (f) => (f.resource_id ? 'One unit' : 'Whole business'),
                },
                {
                  key: 'last_sync_status',
                  header: 'Last sync',
                  render: (f) =>
                    !f.last_synced_at ? (
                      <Badge tone="neutral">never</Badge>
                    ) : String(f.last_sync_status || '').startsWith('error') ? (
                      <Badge tone="danger" title={f.last_sync_status}>failing</Badge>
                    ) : (
                      formatDateTime(f.last_synced_at)
                    ),
                },
              ]}
              rows={feeds}
              rowKey="id"
              dense
            />
          </div>
        )}
      </Card>
    </>
  );
}
