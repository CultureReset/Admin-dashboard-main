/**
 * Cross-board availability search — pick a date, see what is open everywhere.
 *
 * This is the question the whole platform exists to answer, and no single
 * booking system can. FareHarbor knows about its own charters, Airbnb knows
 * about its own condos, and neither will tell you what is free on the 15th
 * across a fishing marina, a parasail operator, three condo complexes and a
 * photographer. This will, because the answer is assembled from the forwarded
 * confirmation emails and the iCal feeds rather than from any one platform.
 *
 * Two things worth understanding before reading a result:
 *
 * **Coverage.** A condo has to be free EVERY night of a trip to be bookable;
 * a charter only needs one open day in the window. The vertical picks the
 * right rule automatically and it can be overridden — searching stays with
 * "any open day" is a real question, it just means something different.
 *
 * **Assumed vs confirmed.** A row only exists once something CLAIMS a date, so
 * a date with no row means nothing has taken it. With a capacity on file that
 * reads as open; without one it reads as unknown, and unknown never counts as
 * available. A business showing "open" purely on capacity is flagged, because
 * nothing has actually confirmed those dates.
 *
 * GET /api/admin/platform/search
 * GET /api/admin/platform/verticals
 */

import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { formatDate } from '../../lib/fields.jsx';

function isoDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const STATUS_TONE = {
  available: 'success',
  limited: 'warning',
  full: 'danger',
  blocked: 'neutral',
  unknown: 'neutral',
};

export default function AvailabilitySearch() {
  const [from, setFrom] = useState(() => isoDay(0));
  const [to, setTo] = useState(() => isoDay(2));
  const [vertical, setVertical] = useState('all');
  const [coverage, setCoverage] = useState('');
  const [q, setQ] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [includeUnits, setIncludeUnits] = useState(false);
  const [detailFor, setDetailFor] = useState(null);

  const verticalsQuery = useAsync(
    async () => api.get(endpoints.bookingPlatform.verticals()),
    [],
    { initialData: null },
  );

  const searchQuery = useAsync(
    async () =>
      api.get(endpoints.bookingPlatform.search(), {
        query: {
          from,
          to,
          vertical: vertical === 'all' ? undefined : vertical,
          coverage: coverage || undefined,
          q: q.trim() || undefined,
          only_available: onlyAvailable ? 'true' : undefined,
          include_units: includeUnits ? 'true' : undefined,
          limit: 1000,
        },
      }),
    [from, to, vertical, coverage, q, onlyAvailable, includeUnits],
    { initialData: null },
  );

  const verticals = useMemo(
    () => (Array.isArray(verticalsQuery.data?.verticals) ? verticalsQuery.data.verticals : []),
    [verticalsQuery.data],
  );
  const results = useMemo(
    () => (Array.isArray(searchQuery.data?.results) ? searchQuery.data.results : []),
    [searchQuery.data],
  );
  const byVertical = searchQuery.data?.by_vertical || [];
  const dates = searchQuery.data?.dates || [];

  const setRange = useCallback((nights) => {
    setFrom(isoDay(0));
    setTo(isoDay(nights));
  }, []);

  const labelFor = (id) => verticals.find((v) => v.id === id)?.label || id;

  return (
    <>
      <PageHeader
        title="Availability search"
        description="One date, every industry — condos, charters, cruises, parasailing, photographers."
        actions={<Button onClick={searchQuery.reload} disabled={searchQuery.loading}>Search</Button>}
      />

      <Notice tone="info" title="Assembled from emails and feeds, not from any one platform">
        <p>
          No booking system will tell you what is free across a marina, three condo buildings and
          a photographer on the same night. This can, because it is built from the confirmation
          emails businesses forward and the iCal feeds they connect.
        </p>
        <p style={{ marginTop: 8 }}>
          A date with no row means nothing has claimed it — open if we know the{' '}
          <Link to="/booking/inventory">capacity</Link>, unknown if we don&apos;t. Unknown never
          counts as available.
        </p>
        <p style={{ marginTop: 8 }}>
          For one industry at a time see <Link to="/booking/industries">Industry Calendars</Link>;
          for one business, its own <Link to="/booking/calendar">calendar page</Link>.
        </p>
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <Card>
        <div className="row-wrap" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
          <input
            className="ui-input"
            type="date"
            style={{ width: 'auto' }}
            value={from}
            aria-label="From date"
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="muted">to</span>
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
            value={vertical}
            aria-label="Industry"
            onChange={(e) => {
              setVertical(e.target.value);
              // The vertical carries its own coverage rule; an explicit choice
              // from a previous search would silently override it.
              setCoverage('');
            }}
          >
            <option value="all">Every industry</option>
            {verticals.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
          <select
            className="ui-input ui-input--select"
            style={{ width: 'auto' }}
            value={coverage}
            aria-label="Coverage"
            onChange={(e) => setCoverage(e.target.value)}
          >
            <option value="">
              Coverage: {searchQuery.data?.coverage === 'all' ? 'every day' : 'any open day'} (auto)
            </option>
            <option value="any">Any open day in the range</option>
            <option value="all">Open every day in the range</option>
          </select>
          <input
            className="ui-input"
            style={{ width: 'auto', minWidth: 180 }}
            value={q}
            placeholder="Name, type or city…"
            aria-label="Search"
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="row-wrap" style={{ gap: 'var(--space-4)', marginTop: 'var(--space-3)', alignItems: 'center' }}>
          <Button size="sm" onClick={() => setRange(0)}>Today</Button>
          <Button size="sm" onClick={() => setRange(1)}>Tonight + tomorrow</Button>
          <Button size="sm" onClick={() => setRange(6)}>Next 7 days</Button>
          <label className="row" style={{ gap: 6 }}>
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
            />
            <span>Only what&apos;s open</span>
          </label>
          <label className="row" style={{ gap: 6 }}>
            <input
              type="checkbox"
              checked={includeUnits}
              onChange={(e) => setIncludeUnits(e.target.checked)}
            />
            <span>List units separately</span>
          </label>
        </div>
      </Card>

      <div style={{ height: 'var(--space-4)' }} />

      {searchQuery.loading && <LoadingBlock />}
      {searchQuery.error && <ErrorState error={searchQuery.error} onRetry={searchQuery.reload} />}

      {!searchQuery.loading && !searchQuery.error && searchQuery.data && (
        <>
          <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
            <Stat
              label="Open"
              value={searchQuery.data.available ?? 0}
              tone={searchQuery.data.available ? 'success' : 'neutral'}
              hint={
                searchQuery.data.coverage === 'all'
                  ? `every day, ${dates.length} in range`
                  : `any of ${dates.length} day${dates.length === 1 ? '' : 's'}`
              }
            />
            <Stat label="Searched" value={searchQuery.data.searched ?? 0} />
            <Stat
              label="Nothing has confirmed"
              value={searchQuery.data.assumed_only ?? 0}
              tone={searchQuery.data.assumed_only ? 'warning' : 'neutral'}
              hint="Open on capacity alone"
            />
            <Stat
              label="No data at all"
              value={searchQuery.data.no_data ?? 0}
              tone={searchQuery.data.no_data ? 'warning' : 'neutral'}
            />
          </div>

          {byVertical.length > 1 && (
            <>
              <Card title="By industry" subtitle="Click one to narrow the search.">
                <div className="row-wrap" style={{ gap: 6 }}>
                  {byVertical.map((v) => (
                    <button
                      key={v.vertical}
                      type="button"
                      className={`ui-multi__chip ${vertical === v.vertical ? 'is-active' : ''}`}
                      onClick={() => {
                        setVertical(vertical === v.vertical ? 'all' : v.vertical);
                        setCoverage('');
                      }}
                      title={`${v.total} searched · ${v.no_data} with no data`}
                    >
                      {labelFor(v.vertical)} · {v.available}
                    </button>
                  ))}
                </div>
              </Card>
              <div style={{ height: 'var(--space-5)' }} />
            </>
          )}

          <Card padded={false}>
            <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
              {results.length === 0 ? (
                <EmptyState
                  icon="🗓️"
                  title="Nothing open in that window"
                  description={
                    onlyAvailable
                      ? 'Untick "Only what’s open" to see who was searched and why they did not qualify.'
                      : 'No business matched these filters.'
                  }
                />
              ) : (
                <DataTable
                  columns={[
                    {
                      key: 'entity_name',
                      header: 'Business',
                      value: (row) => `${row.entity_name || ''} ${row.entity_slug} ${row.city || ''}`,
                      render: (row) => (
                        <div>
                          <div className="ui-cell-primary">
                            <Link to={`/booking/calendar/${encodeURIComponent(row.entity_slug)}`}>
                              {row.entity_name || row.entity_slug}
                            </Link>
                          </div>
                          <div className="ui-cell-sub">
                            {[row.entity_subtype, row.city].filter(Boolean).join(' · ') || row.entity_slug}
                          </div>
                        </div>
                      ),
                    },
                    {
                      key: 'vertical',
                      header: 'Industry',
                      hideOn: 'narrow',
                      render: (row) => <Badge tone="info">{row.vertical}</Badge>,
                    },
                    {
                      key: 'open_days',
                      header: 'Open',
                      align: 'right',
                      render: (row) =>
                        row.meets_coverage ? (
                          <Badge tone={row.covers_all_days ? 'success' : 'warning'}>
                            {row.open_days} of {dates.length}
                          </Badge>
                        ) : (
                          <span className="faint">—</span>
                        ),
                    },
                    {
                      key: 'unit_count',
                      header: 'Units',
                      align: 'right',
                      searchable: false,
                      render: (row) =>
                        row.unit_count ? (
                          <Badge tone={row.units_available ? 'success' : 'danger'}>
                            {row.units_available} / {row.unit_count}
                          </Badge>
                        ) : (
                          <span className="faint">—</span>
                        ),
                    },
                    {
                      key: 'min_remaining',
                      header: 'Fewest left',
                      align: 'right',
                      hideOn: 'narrow',
                      render: (row) =>
                        row.min_remaining != null ? row.min_remaining : <span className="faint">—</span>,
                    },
                    {
                      key: 'confidence',
                      header: 'Confidence',
                      sortable: false,
                      searchable: false,
                      render: (row) => {
                        if (!row.capacity_known) {
                          return (
                            <Badge tone="neutral" title="No capacity on file — we only know nothing has blocked it">
                              No capacity
                            </Badge>
                          );
                        }
                        if (!row.has_data) {
                          return (
                            <Badge tone="warning" title="Open on capacity alone — nothing has claimed a date in this window">
                              Assumed
                            </Badge>
                          );
                        }
                        return <Badge tone="success">Confirmed</Badge>;
                      },
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
                          <Button size="sm" onClick={() => setDetailFor(row)}>Day by day</Button>
                          <Link
                            className="ui-btn ui-btn--default ui-btn--sm"
                            to={`/booking/calendar/${encodeURIComponent(row.entity_slug)}`}
                          >
                            Calendar
                          </Link>
                        </span>
                      ),
                    },
                  ]}
                  rows={results}
                  rowKey="entity_slug"
                  searchPlaceholder="Filter results…"
                  initialSort={{ key: 'open_days', direction: 'desc' }}
                />
              )}
            </div>
          </Card>
        </>
      )}

      <Modal
        open={Boolean(detailFor)}
        onClose={() => setDetailFor(null)}
        size="lg"
        title={detailFor ? detailFor.entity_name || detailFor.entity_slug : ''}
        description={detailFor ? `${formatDate(from)} – ${formatDate(to)}` : ''}
      >
        {detailFor && <DayByDay row={detailFor} />}
      </Modal>
    </>
  );
}

/** Every day in the window for one business, plus its units if it has any. */
function DayByDay({ row }) {
  return (
    <>
      <div className="row-wrap" style={{ gap: 6, marginBottom: 'var(--space-4)' }}>
        {(row.days || []).map((day) => (
          <span
            key={day.date}
            title={[
              day.date,
              day.status,
              day.remaining != null ? `${day.remaining}${day.total != null ? ` of ${day.total}` : ''}` : null,
              day.assumed ? 'nothing has claimed this date' : (day.sources || []).join(', '),
            ].filter(Boolean).join(' · ')}
          >
            <Badge tone={STATUS_TONE[day.status] || 'neutral'}>
              {day.date.slice(5)}
              {day.remaining != null ? ` · ${day.remaining}` : ''}
              {day.assumed ? ' ?' : ''}
            </Badge>
          </span>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        A <code className="mono">?</code> means nothing has claimed that date — it is open because
        capacity says so, not because anything confirmed it.
      </p>

      {row.units && row.units.length > 0 && (
        <>
          <div style={{ height: 'var(--space-4)' }} />
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
                key: 'meets_coverage',
                header: 'Free',
                render: (u) =>
                  u.meets_coverage ? <Badge tone="success">Yes</Badge> : <Badge tone="danger">No</Badge>,
              },
              {
                key: 'available_dates',
                header: 'Dates',
                sortable: false,
                render: (u) =>
                  u.available_dates.length ? (
                    <span className="mono" style={{ fontSize: 12 }}>
                      {u.available_dates.map((d) => d.slice(5)).join(', ')}
                    </span>
                  ) : (
                    <span className="faint">none</span>
                  ),
              },
            ]}
            rows={row.units}
            rowKey="entity_slug"
            dense
          />
        </>
      )}
    </>
  );
}
