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
  const [capability, setCapability] = useState('units');
  const [from, setFrom] = useState(() => isoDay(1));
  const [to, setTo] = useState(() => isoDay(3));
  const [useDates, setUseDates] = useState(true);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({});
  const [ran, setRan] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const metaQuery = useAsync(
    async () => api.get(endpoints.bookingPlatform.capabilities()),
    [],
    { initialData: null },
  );

  // Catalog-backed filters (amenities, species, activities) get their options
  // from the database, not from the column map.
  const amenityQuery = useAsync(async () => api.get(endpoints.bookingPlatform.catalog('amenities')), [], { initialData: null });
  const speciesQuery = useAsync(async () => api.get(endpoints.bookingPlatform.catalog('species')), [], { initialData: null });
  const activityQuery = useAsync(async () => api.get(endpoints.bookingPlatform.catalog('activities')), [], { initialData: null });

  const catalogs = useMemo(() => ({
    amenities: (amenityQuery.data?.groups || []).flatMap((g) => g.items.map((i) => ({ value: i.id, label: i.label, group: g.category }))),
    species: (speciesQuery.data?.rows || []).map((i) => ({ value: i.id, label: i.label, group: i.category })),
    activities: (activityQuery.data?.rows || []).map((i) => ({ value: i.id, label: i.label, group: i.category })),
  }), [amenityQuery.data, speciesQuery.data, activityQuery.data]);

  const allCapabilities = useMemo(
    () => (Array.isArray(metaQuery.data?.capabilities) ? metaQuery.data.capabilities : []),
    [metaQuery.data],
  );
  const allSearchable = useMemo(
    () => (Array.isArray(metaQuery.data?.searchable) ? metaQuery.data.searchable : []),
    [metaQuery.data],
  );
  // Filters from every capability stay active at once — a business is not
  // limited to one, so a search should not be either. The picker below only
  // decides which set is on screen.
  const searchable = useMemo(
    () => allSearchable.filter((s) => s.capability === capability),
    [allSearchable, capability],
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
    for (const r of results) {
      for (const rows of Object.values(r.matched || {})) {
        const row = Array.isArray(rows) ? rows[0] : rows;
        for (const k of Object.keys(row || {})) seen.add(k);
      }
    }
    // Ids, foreign keys and timestamps are real columns but say nothing to a
    // person reading a result; the asked-for columns lead, then the rest.
    const NOISE = /^(id|.*_id|created_at|updated_at|entity_slug|is_active|sort_order)$/;
    // Filter ids are `capability.column`; the result rows are keyed by column.
    const asked = keys.map((k) => k.split('.').pop());
    const ordered = [
      ...asked,
      ...[...seen].filter((k) => !asked.includes(k) && !NOISE.test(k)),
    ].slice(0, 6);
    const valueOf = (row, key) => {
      for (const rows of Object.values(row.matched || {})) {
        const first = Array.isArray(rows) ? rows[0] : rows;
        if (first && first[key] !== undefined) return first[key];
      }
      return undefined;
    };
    return ordered.map((key) => {
      const field = allSearchable.find((s) => s.name === key);
      return {
        key: `attr_${key}`,
        header: field ? field.label : prettify(key),
        hideOn: asked.includes(key) ? undefined : 'narrow',
        sortable: false,
        value: (row) => String(valueOf(row, key) ?? ''),
        render: (row) => {
          const v = valueOf(row, key);
          if (v === undefined || v === null) return <span className="faint">—</span>;
          if (typeof v === 'boolean') return v ? <Badge tone="success">yes</Badge> : <Badge tone="neutral">no</Badge>;
          if (Array.isArray(v)) return <span style={{ fontSize: 12 }}>{v.map(prettify).join(', ')}</span>;
          if (field?.unit === '$') return formatMoney(v);
          return `${v}${field?.unit && field.unit !== '$' ? ` ${field.unit}` : ''}`;
        },
      };
    });
  }, [filters, results, allSearchable]);

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
          <Link to="/directory/entity">listing data</Link> with the{' '}
          <Link to="/booking/availability">calendar</Link> and returns only what satisfies both.
        </p>
        <p style={{ marginTop: 8 }}>
          Every filter is a real comparison on a real column —
          <code className="mono"> units.bedrooms &gt;= 2</code>,
          <code className="mono"> boats.length_ft &gt;= 45</code>. No industry is named anywhere: a
          filter on boats finds any business with a boat that long, whatever the directory calls
          it. A business with nothing filled in cannot be matched; its Listing Data tab fixes that.
        </p>
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <Card title="What are they looking for?">
        <div className="row-wrap" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
          <select
            className="ui-input ui-input--select"
            style={{ width: 'auto' }}
            value={capability}
            aria-label="What they are looking for"
            onChange={(e) => setCapability(e.target.value)}
          >
            {allCapabilities.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
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

      {metaQuery.loading && <LoadingBlock />}
      {metaQuery.error && <ErrorState error={metaQuery.error} onRetry={metaQuery.reload} />}

      {searchable.length > 0 && (
        <Card
          title={`${allCapabilities.find((c) => c.key === capability)?.label || capability} — what can they ask for?`}
          subtitle="Leave anything blank. Filters from other groups stay active — switch groups and add more."
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
                key={field.id}
                field={field}
                value={filters[field.id]}
                onChange={(v) => setFilter(field.id, v)}
                catalog={field.type === 'catalog' ? catalogs[field.catalog] : undefined}
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
                    <Badge key={x.id} tone="info" title={x.table ? `on ${x.table}` : undefined}>
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
                      ? 'No row matches those columns. Either nothing fits, or the businesses that do have not filled their listing data in.'
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
function FilterControl({ field, value, onChange, catalog }) {
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

  // A catalog-backed filter (amenities, species) renders the same chip row as
  // an enum, but its options are rows rather than strings.
  const options = catalog
    ? catalog
    : (field.suggestions || []).map((o) => ({ value: o, label: prettify(o) }));

  if (catalog || field.suggestions) {
    const selected = Array.isArray(value) ? value : value ? [value] : [];
    return (
      <div className="ui-field">
        <span className="ui-field__label">
          {field.label} {hint && <span className="faint">({hint})</span>}
        </span>
        <div className="row-wrap" style={{ gap: 4, maxHeight: 190, overflowY: 'auto' }}>
          {options.length === 0 && <span className="faint">No options</span>}
          {options.map((option) => {
            const on = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                title={option.group}
                className={`ui-multi__chip ${on ? 'is-active' : ''}`}
                onClick={() =>
                  onChange(on ? selected.filter((s) => s !== option.value) : [...selected, option.value])
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="ui-field">
      <label className="ui-field__label" htmlFor={`match-${field.id}`}>
        {field.label} {hint && <span className="faint">({hint})</span>}
        {field.unit && field.unit !== '$' ? <span className="faint"> — {field.unit}</span> : null}
      </label>
      <input
        id={`match-${field.id}`}
        className="ui-input"
        type={field.type === 'int' || field.type === 'decimal' ? 'number' : 'text'}
        min={field.type === 'int' || field.type === 'decimal' ? 0 : undefined}
        step={field.type === 'decimal' ? 'any' : undefined}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
