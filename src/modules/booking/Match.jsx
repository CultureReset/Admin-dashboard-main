/**
 * Find a match — description and dates in one question.
 *
 *   "A two bedroom two bath at Phoenix West on these nights."
 *   "A charter for eight people, at least eight hours, a 45ft boat with AC
 *    and a head."
 *
 * Neither half is an answer on its own: a 2-bed 2-bath that is booked all week
 * is not what the guest asked for, and a free week in a studio is not either.
 * So this intersects the structured listing data with the availability
 * calendar and returns only what satisfies both.
 *
 * The filter controls are generated from the industry's blueprint, which the
 * API serves. Pick condos and you get bedrooms, bathrooms, sleeps, view; pick
 * charters and you get boat length, anglers, trip lengths, AC, head. Nothing
 * here names a field, so a field added to the blueprint becomes filterable
 * without touching this file.
 *
 * POST /api/admin/platform/match
 * GET  /api/admin/platform/blueprint/:vertical
 */

import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { formatMoney } from '../../lib/fields.jsx';

function isoDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const prettify = (v) => String(v).replace(/_/g, ' ');

export default function Match() {
  const [vertical, setVertical] = useState('condo');
  const [from, setFrom] = useState(() => isoDay(1));
  const [to, setTo] = useState(() => isoDay(3));
  const [useDates, setUseDates] = useState(true);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({});
  const [ran, setRan] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const verticalsQuery = useAsync(
    async () => api.get(endpoints.bookingPlatform.verticals()),
    [],
    { initialData: null },
  );

  const blueprintQuery = useAsync(
    async () => api.get(endpoints.bookingPlatform.blueprint(vertical)),
    [vertical],
    { initialData: null },
  );

  const verticals = Array.isArray(verticalsQuery.data?.verticals) ? verticalsQuery.data.verticals : [];
  const searchable = useMemo(
    () => (Array.isArray(blueprintQuery.data?.searchable) ? blueprintQuery.data.searchable : []),
    [blueprintQuery.data],
  );

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value === '' || value === false || value === undefined || (Array.isArray(value) && value.length === 0)) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }, []);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const result = await api.post(endpoints.bookingPlatform.match(), {
        vertical,
        from: useDates ? from : undefined,
        to: useDates ? to : undefined,
        filters,
        q: q.trim() || undefined,
        limit: 200,
      });
      setRan(result);
    } catch (err) {
      setError(err);
      setRan(null);
    } finally {
      setRunning(false);
    }
  };

  const results = Array.isArray(ran?.results) ? ran.results : [];
  const activeFilters = Object.keys(filters).length;

  /** The columns worth showing differ per industry, so they are derived. */
  const attrColumns = useMemo(() => {
    const keys = Object.keys(filters);
    // Show what was asked for first, then anything else the results carry, so
    // the answer shows its work rather than just asserting a match.
    const seen = new Set(keys);
    for (const r of results) for (const k of Object.keys(r.attributes || {})) seen.add(k);
    const ordered = [...keys, ...[...seen].filter((k) => !keys.includes(k))].slice(0, 6);
    return ordered.map((key) => {
      const field = searchable.find((s) => s.key === key);
      return {
        key: `attr_${key}`,
        header: field ? field.label : prettify(key),
        hideOn: keys.includes(key) ? undefined : 'narrow',
        sortable: false,
        value: (row) => String(row.attributes?.[key] ?? ''),
        render: (row) => {
          const v = row.attributes?.[key];
          if (v === undefined || v === null) return <span className="faint">—</span>;
          if (typeof v === 'boolean') return v ? <Badge tone="success">yes</Badge> : <Badge tone="neutral">no</Badge>;
          if (Array.isArray(v)) return <span style={{ fontSize: 12 }}>{v.map(prettify).join(', ')}</span>;
          if (field?.unit === '$') return formatMoney(v);
          return `${v}${field?.unit && field.unit !== '$' ? ` ${field.unit}` : ''}`;
        },
      };
    });
  }, [filters, results, searchable]);

  return (
    <>
      <PageHeader
        title="Find a match"
        description="What a guest actually asks for — a description and some dates, answered together."
        actions={<Button variant="primary" loading={running} onClick={run}>Search</Button>}
      />

      <Notice tone="info" title="Both halves, or it is not an answer">
        <p>
          A two-bed two-bath that is booked all week is not what someone asked for, and a free week
          in a studio is not either. This intersects the{' '}
          <Link to="/booking/inventory">listing data</Link> with the{' '}
          <Link to="/booking/availability">calendar</Link> and returns only what satisfies both.
        </p>
        <p style={{ marginTop: 8 }}>
          The filters below come from the industry&apos;s blueprint. A business with nothing filled
          in cannot be matched — its Attributes tab is where that gets fixed.
        </p>
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <Card title="What are they looking for?">
        <div className="row-wrap" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
          <select
            className="ui-input ui-input--select"
            style={{ width: 'auto' }}
            value={vertical}
            aria-label="Industry"
            onChange={(e) => { setVertical(e.target.value); setFilters({}); setRan(null); }}
          >
            {verticals.filter((v) => v.id !== 'other').map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
          <input
            className="ui-input"
            style={{ width: 'auto', minWidth: 180 }}
            value={q}
            placeholder="Name or city — e.g. Phoenix"
            aria-label="Name or city"
            onChange={(e) => setQ(e.target.value)}
          />
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={useDates} onChange={(e) => setUseDates(e.target.checked)} />
            <span>On specific dates</span>
          </label>
          {useDates && (
            <>
              <input
                className="ui-input" type="date" style={{ width: 'auto' }}
                value={from} aria-label="From date" onChange={(e) => setFrom(e.target.value)}
              />
              <span className="muted">to</span>
              <input
                className="ui-input" type="date" style={{ width: 'auto' }}
                value={to} aria-label="To date" onChange={(e) => setTo(e.target.value)}
              />
            </>
          )}
        </div>
      </Card>

      <div style={{ height: 'var(--space-4)' }} />

      {blueprintQuery.loading && <LoadingBlock />}
      {blueprintQuery.error && <ErrorState error={blueprintQuery.error} onRetry={blueprintQuery.reload} />}

      {searchable.length > 0 && (
        <Card
          title={`${blueprintQuery.data?.label || vertical} — what can they ask for?`}
          subtitle="Leave anything blank to not filter on it."
          actions={
            activeFilters > 0 && (
              <Button size="sm" onClick={() => setFilters({})}>Clear {activeFilters}</Button>
            )
          }
        >
          <div
            style={{
              display: 'grid',
              gap: 'var(--space-3)',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            {searchable.map((field) => (
              <FilterControl
                key={field.key}
                field={field}
                value={filters[field.key]}
                onChange={(v) => setFilter(field.key, v)}
              />
            ))}
          </div>
        </Card>
      )}

      <div style={{ height: 'var(--space-4)' }} />

      {error && <ErrorState error={error} onRetry={run} />}

      {ran && (
        <>
          <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
            <Stat label="Matches" value={ran.total ?? 0} tone={ran.total ? 'success' : 'warning'} />
            <Stat
              label="Fit the description"
              value={ran.described ?? '—'}
              hint={ran.described == null ? 'no filters applied' : undefined}
            />
            <Stat label="In this industry" value={ran.in_industry ?? 0} />
            {ran.coverage && (
              <Stat
                label="Coverage"
                value={ran.coverage === 'all' ? 'Every day' : 'Any day'}
                hint={`${(ran.dates || []).length} days`}
              />
            )}
          </div>

          {(ran.filters || []).length > 0 && (
            <>
              <Card title="Asked for">
                <div className="row-wrap" style={{ gap: 6 }}>
                  {ran.filters.map((x) => (
                    <Badge key={x.key} tone="info">
                      {x.label}{' '}
                      {x.rule === 'min' ? '≥' : x.rule === 'max' ? '≤' : x.rule === 'has' ? '' : '='}{' '}
                      {Array.isArray(x.value) ? x.value.map(prettify).join(', ') : x.rule === 'has' ? 'yes' : String(x.value)}
                    </Badge>
                  ))}
                </div>
              </Card>
              <div style={{ height: 'var(--space-4)' }} />
            </>
          )}

          <Card padded={false}>
            <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
              {results.length === 0 ? (
                <EmptyState
                  icon="🔍"
                  title="Nothing matches"
                  description={
                    ran.reason === 'no listing matches the description'
                      ? 'No listing has those attributes on file. Either nothing fits, or the businesses that do have not filled theirs in.'
                      : 'Listings fit the description, but none is free on those dates.'
                  }
                />
              ) : (
                <DataTable
                  columns={[
                    {
                      key: 'entity_name',
                      header: 'Listing',
                      value: (r) => `${r.entity_name || ''} ${r.parent_name || ''} ${r.city || ''}`,
                      render: (r) => (
                        <div>
                          <div className="ui-cell-primary">
                            <Link to={`/booking/calendar/${encodeURIComponent(r.entity_slug)}`}>
                              {r.entity_name || r.entity_slug}
                            </Link>
                          </div>
                          <div className="ui-cell-sub">
                            {[r.parent_name, r.city].filter(Boolean).join(' · ') || r.entity_subtype}
                          </div>
                        </div>
                      ),
                    },
                    ...attrColumns,
                    {
                      key: 'open_days',
                      header: 'Free',
                      align: 'right',
                      render: (r) =>
                        r.open_days == null ? (
                          <span className="faint">—</span>
                        ) : (
                          <Badge tone={r.covers_all_days ? 'success' : 'warning'}>
                            {r.open_days} / {(ran.dates || []).length}
                          </Badge>
                        ),
                    },
                    {
                      key: 'has_data',
                      header: 'Confidence',
                      sortable: false,
                      searchable: false,
                      hideOn: 'narrow',
                      render: (r) =>
                        !r.capacity_known ? (
                          <Badge tone="neutral">No capacity</Badge>
                        ) : r.has_data ? (
                          <Badge tone="success">Confirmed</Badge>
                        ) : (
                          <Badge tone="warning" title="Free on capacity alone — nothing has claimed those dates">
                            Assumed
                          </Badge>
                        ),
                    },
                    {
                      key: '__actions',
                      header: '',
                      align: 'right',
                      sortable: false,
                      searchable: false,
                      stopPropagation: true,
                      render: (r) => (
                        <Link
                          className="ui-btn ui-btn--default ui-btn--sm"
                          to={`/booking/calendar/${encodeURIComponent(r.entity_slug)}`}
                        >
                          Calendar
                        </Link>
                      ),
                    },
                  ]}
                  rows={results}
                  rowKey="entity_slug"
                  searchPlaceholder="Filter matches…"
                />
              )}
            </div>
          </Card>
        </>
      )}

      {!ran && !error && (
        <Card>
          <p className="muted">
            Set what they are looking for and press Search. With no filters you get everything in
            the industry that is free on those dates.
          </p>
        </Card>
      )}
    </>
  );
}

/** One filter, rendered from its blueprint descriptor. */
function FilterControl({ field, value, onChange }) {
  const hint =
    field.search === 'min' ? 'at least'
      : field.search === 'max' ? 'at most'
        : field.search === 'any' ? 'any of'
          : field.search === 'eq' ? 'exactly'
            : null;

  if (field.type === 'bool') {
    return (
      <label className="row" style={{ gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        <span>{field.label}</span>
      </label>
    );
  }

  if (field.type === 'multi' || (field.type === 'select' && field.options)) {
    const selected = Array.isArray(value) ? value : value ? [value] : [];
    return (
      <div className="ui-field">
        <span className="ui-field__label">
          {field.label} {hint && <span className="faint">({hint})</span>}
        </span>
        <div className="row-wrap" style={{ gap: 4 }}>
          {(field.options || []).map((option) => {
            const on = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                className={`ui-multi__chip ${on ? 'is-active' : ''}`}
                onClick={() =>
                  onChange(on ? selected.filter((s) => s !== option) : [...selected, option])
                }
              >
                {prettify(option)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="ui-field">
      <label className="ui-field__label" htmlFor={`match-${field.key}`}>
        {field.label} {hint && <span className="faint">({hint})</span>}
        {field.unit && field.unit !== '$' ? <span className="faint"> — {field.unit}</span> : null}
      </label>
      <input
        id={`match-${field.key}`}
        className="ui-input"
        type={field.type === 'number' ? 'number' : 'text'}
        min={field.type === 'number' ? 0 : undefined}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
