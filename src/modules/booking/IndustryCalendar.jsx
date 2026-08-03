/**
 * A calendar page for one industry.
 *
 * Fishing charters has its own page. Dolphin cruises has its own. Condos,
 * hotels, parasailing, photographers — each is a route of its own, reached
 * from the sidebar, because they are run by different people and searched
 * separately even though they share a database.
 *
 * The month grid here counts BUSINESSES rather than seats: on the 14th, how
 * many charters have something open. Clicking a day lists exactly which ones,
 * and every business links through to its own calendar page.
 *
 * Coverage differs by industry and is not cosmetic — a condo has to be free
 * every night of a stay, a charter needs one open day. Each industry carries
 * its own default and it can be overridden here.
 *
 * GET /api/admin/platform/industry-calendar?vertical=…&month=YYYY-MM
 */

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { MonthCalendar, MonthNav, thisMonth } from '../../ui/MonthCalendar.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { formatDate } from '../../lib/fields.jsx';

export default function IndustryCalendar() {
  const { vertical } = useParams();
  const [month, setMonth] = useState(thisMonth);
  const [coverage, setCoverage] = useState('');
  const [includeUnits, setIncludeUnits] = useState(false);
  const [pickedDay, setPickedDay] = useState(null);

  const query = useAsync(
    async () =>
      api.get(endpoints.bookingPlatform.industryCalendar(), {
        query: {
          vertical,
          month,
          coverage: coverage || undefined,
          include_units: includeUnits ? 'true' : undefined,
          limit: 3000,
        },
      }),
    [vertical, month, coverage, includeUnits],
    { initialData: null },
  );

  const data = query.data;
  const businesses = useMemo(
    () => (Array.isArray(data?.businesses) ? data.businesses : []),
    [data],
  );

  /**
   * The API counts businesses per day; the shared grid speaks in
   * remaining/total/status. Mapped here rather than in the API so the grid
   * stays one shape everywhere it is used.
   */
  const days = useMemo(
    () =>
      (Array.isArray(data?.days) ? data.days : []).map((d) => ({
        date: d.date,
        remaining: d.open_businesses,
        total: d.total_businesses,
        status:
          d.total_businesses === 0
            ? 'unknown'
            : d.open_businesses === 0
              ? 'full'
              : d.open_businesses >= d.total_businesses
                ? 'available'
                : d.open_businesses / d.total_businesses <= 0.25
                  ? 'limited'
                  : 'available',
        slugs: d.slugs,
      })),
    [data],
  );

  const openOnPicked = useMemo(() => {
    if (!pickedDay) return [];
    const slugs = new Set(pickedDay.slugs || []);
    return businesses.filter((b) => slugs.has(b.entity_slug));
  }, [pickedDay, businesses]);

  const dayCount = days.length || 1;

  return (
    <>
      <PageHeader
        title={data?.label || 'Industry calendar'}
        // Not "every ${label.toLowerCase()}" — the labels are plural phrases
        // ("Fishing charters", "Condos & vacation rentals") and that reads as
        // "Every fishing charters in the database".
        description={
          data?.label
            ? `${data.label} across the whole database, one month at a time.`
            : 'One industry, one month at a time.'
        }
        actions={
          <>
            <Link className="ui-btn ui-btn--default ui-btn--md" to="/booking/industries">All industries</Link>
            <Button onClick={query.reload} loading={query.loading}>Reload</Button>
          </>
        }
      />

      <Notice tone="info" title="This counts businesses, not seats">
        <p>
          A day shows how many businesses in this industry have something open on it. Click one to
          see exactly which, and open any of them for its own calendar.
        </p>
        <p style={{ marginTop: 8 }}>
          {data?.coverage === 'all'
            ? 'Coverage is “open every day in view”, because a stay has to cover the whole trip.'
            : 'Coverage is “any open day”, which is the right question for a charter or a cruise.'}
        </p>
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <Card>
        <div className="row-wrap" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
          <MonthNav month={month} onChange={setMonth} />
          <select
            className="ui-input ui-input--select"
            style={{ width: 'auto' }}
            value={coverage}
            aria-label="Coverage"
            onChange={(e) => setCoverage(e.target.value)}
          >
            <option value="">
              Coverage: {data?.coverage === 'all' ? 'every day' : 'any open day'} (this industry&apos;s default)
            </option>
            <option value="any">Any open day</option>
            <option value="all">Open every day in view</option>
          </select>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={includeUnits} onChange={(e) => setIncludeUnits(e.target.checked)} />
            <span>List units separately</span>
          </label>
        </div>
      </Card>

      <div style={{ height: 'var(--space-4)' }} />

      {query.loading && !data && <LoadingBlock />}
      {query.error && <ErrorState error={query.error} onRetry={query.reload} />}

      {data && (
        <>
          <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
            <Stat label="Businesses" value={data.total ?? 0} />
            <Stat
              label="Open today"
              value={data.open_today ?? '—'}
              tone={data.open_today ? 'success' : 'neutral'}
            />
            <Stat
              label="Sending data"
              value={data.with_data ?? 0}
              tone={data.with_data ? 'success' : 'warning'}
              hint="something has claimed a date"
            />
            <Stat
              label="No capacity set"
              value={data.without_capacity ?? 0}
              tone={data.without_capacity ? 'warning' : 'success'}
              hint="cannot report availability"
            />
          </div>

          {data.total === 0 ? (
            <EmptyState
              icon="🏷️"
              title="No businesses in this industry"
              description="Nothing in the database classifies here yet."
            />
          ) : (
            <>
              <Card title={`${data.label} — how many are open each day`}>
                <MonthCalendar
                  month={month}
                  days={days}
                  unitWord="businesses"
                  onPickDay={setPickedDay}
                  selectedDate={pickedDay?.date}
                />
              </Card>

              {pickedDay && (
                <>
                  <div style={{ height: 'var(--space-4)' }} />
                  <Card
                    padded={false}
                    title={`Open on ${formatDate(pickedDay.date)}`}
                    subtitle={`${openOnPicked.length} of ${data.total}`}
                    actions={<Button size="sm" onClick={() => setPickedDay(null)}>Close</Button>}
                  >
                    <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
                      {openOnPicked.length === 0 ? (
                        <EmptyState
                          icon="📭"
                          title="Nothing open that day"
                          description="Every business in this industry is booked, blocked, or has told us nothing."
                        />
                      ) : (
                        <div className="row-wrap" style={{ gap: 6 }}>
                          {openOnPicked.map((b) => (
                            <Link
                              key={b.entity_slug}
                              to={`/booking/calendar/${encodeURIComponent(b.entity_slug)}`}
                            >
                              <Badge tone={b.has_data ? 'success' : 'warning'}>
                                {b.entity_name || b.entity_slug}
                                {b.unit_count ? ` · ${b.unit_count} units` : ''}
                              </Badge>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                </>
              )}

              <div style={{ height: 'var(--space-5)' }} />

              <Card padded={false} title="Every business in this industry">
                <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
                  <DataTable
                    columns={[
                      {
                        key: 'entity_name',
                        header: 'Business',
                        value: (b) => `${b.entity_name || ''} ${b.entity_slug} ${b.city || ''}`,
                        render: (b) => (
                          <div>
                            <div className="ui-cell-primary">
                              <Link to={`/booking/calendar/${encodeURIComponent(b.entity_slug)}`}>
                                {b.entity_name || b.entity_slug}
                              </Link>
                            </div>
                            <div className="ui-cell-sub">
                              {[b.entity_subtype, b.city].filter(Boolean).join(' · ') || b.entity_slug}
                            </div>
                          </div>
                        ),
                      },
                      {
                        key: 'open_days',
                        header: 'Open',
                        align: 'right',
                        render: (b) => (
                          <Badge tone={b.open_days ? 'success' : 'danger'}>
                            {b.open_days} / {dayCount}
                          </Badge>
                        ),
                      },
                      {
                        key: 'claimed_days',
                        header: 'Claimed',
                        align: 'right',
                        hideOn: 'narrow',
                        render: (b) =>
                          b.claimed_days ? (
                            b.claimed_days
                          ) : (
                            <Badge tone="warning" title="Nothing has claimed a date this month">none</Badge>
                          ),
                      },
                      {
                        key: 'unit_count',
                        header: 'Units',
                        align: 'right',
                        searchable: false,
                        render: (b) => (b.unit_count ? b.unit_count : <span className="faint">—</span>),
                      },
                      {
                        key: 'capacity_known',
                        header: 'Capacity',
                        searchable: false,
                        render: (b) =>
                          b.capacity_known ? (
                            <Badge tone="success">{b.daily_capacity ?? 'per unit'}</Badge>
                          ) : (
                            <Link to="/booking/inventory"><Badge tone="warning">not set</Badge></Link>
                          ),
                      },
                      {
                        key: '__actions',
                        header: '',
                        align: 'right',
                        sortable: false,
                        searchable: false,
                        stopPropagation: true,
                        render: (b) => (
                          <Link
                            className="ui-btn ui-btn--default ui-btn--sm"
                            to={`/booking/calendar/${encodeURIComponent(b.entity_slug)}`}
                          >
                            Calendar
                          </Link>
                        ),
                      },
                    ]}
                    rows={businesses}
                    rowKey="entity_slug"
                    searchPlaceholder="Search this industry…"
                    initialSort={{ key: 'open_days', direction: 'desc' }}
                  />
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </>
  );
}
