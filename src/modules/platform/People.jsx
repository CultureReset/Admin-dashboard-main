/**
 * People — every human the platform knows about, in one place.
 *
 * There is no single "all people" route, because these are genuinely different
 * records in different tables. This screen loads each source in parallel,
 * normalises them onto one shape, and lets you filter by kind:
 *
 *   Admins & users   GET /api/admin/users              users table
 *   Business owners  GET /api/admin/businesses         business accounts
 *   Entity owners    GET /api/admin/link-user?…        who controls a listing
 *   Customers        GET /api/admin/gcr/customers      captured through GCR
 *   Tourists         GET /api/admin/tourists           Trip Swipe accounts
 *   Claimants        GET /api/admin/gcr/claims         people asking for access
 *
 * Each source fails independently — one missing route greys out one row of the
 * summary instead of emptying the screen.
 */

import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, ErrorState, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useEntities } from '../../components/EntityPicker.jsx';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, formatDateTime } from '../../lib/fields.jsx';

/**
 * Each source says where it comes from and how to flatten a row. Adding a
 * people source is one entry here — the table, filters, and counters follow.
 */
const SOURCES = [
  {
    id: 'user',
    label: 'Admins & users',
    tone: 'primary',
    load: () => api.get(endpoints.auth.users()),
    listKeys: ['users'],
    map: (row) => ({
      name: row.name || row.full_name || null,
      email: row.email || null,
      phone: row.phone || null,
      role: row.role || 'user',
      slug: row.entity_slug || null,
      created_at: row.created_at,
      extra: row.site_id ? `site ${row.site_id}` : null,
    }),
  },
  {
    id: 'business',
    label: 'Business accounts',
    tone: 'info',
    load: () => api.get(endpoints.businesses.list()),
    listKeys: ['businesses'],
    map: (row) => ({
      name: row.name || null,
      email: row.email || null,
      phone: row.phone || null,
      role: 'business',
      slug: row.entity_slug || row.gcr_slug || null,
      created_at: row.created_at,
      extra: row.domain || row.plan || null,
    }),
  },
  {
    id: 'customer',
    label: 'Customers',
    tone: 'success',
    load: () => api.get(endpoints.customers.list()),
    listKeys: ['customers'],
    map: (row) => ({
      name: row.name || [row.first_name, row.last_name].filter(Boolean).join(' ') || null,
      email: row.email || null,
      phone: row.phone || null,
      role: 'customer',
      slug: row.entity_slug || null,
      created_at: row.created_at,
      extra: row.source || null,
    }),
  },
  {
    id: 'tourist',
    label: 'Trip Swipe tourists',
    tone: 'warning',
    load: () => api.get(endpoints.tourists.list()),
    listKeys: ['tourists'],
    map: (row) => ({
      name: row.name || null,
      email: row.email || null,
      phone: row.phone || null,
      role: 'tourist',
      slug: null,
      created_at: row.created_at,
      extra: row.points != null ? `${row.points} points` : null,
    }),
  },
  {
    id: 'claimant',
    label: 'Claimants',
    tone: 'danger',
    load: () => api.get(endpoints.claims.list()),
    listKeys: ['claims'],
    map: (row) => ({
      name: row.contact_name || row.business_name || null,
      email: row.email || null,
      phone: row.phone || null,
      role: 'claimant',
      slug: row.entity_slug || null,
      created_at: row.created_at,
      extra: row.status || 'pending',
    }),
  },
];

export default function People() {
  const { entities } = useEntities();
  const [kind, setKind] = useState('');

  const load = useCallback(async () => {
    // Settle every source independently — a 404 on one must not empty the page.
    const results = await Promise.all(
      SOURCES.map(async (source) => {
        try {
          const rows = unwrapList(await source.load(), source.listKeys);
          return { source, rows, error: null };
        } catch (error) {
          return { source, rows: [], error };
        }
      }),
    );
    return results;
  }, []);

  const { data, loading, error, reload } = useAsync(load, [load], { initialData: [] });
  const results = data || [];

  const nameBySlug = useMemo(
    () => Object.fromEntries(entities.map((e) => [e.slug, e.name])),
    [entities],
  );

  const people = useMemo(
    () =>
      results.flatMap(({ source, rows }) =>
        rows.map((row, index) => {
          const flat = source.map(row);
          return {
            ...flat,
            __kind: source.id,
            __kindLabel: source.label,
            __tone: source.tone,
            __business: flat.slug ? nameBySlug[flat.slug] || flat.slug : null,
            __key: `${source.id}-${row.id ?? row.user_id ?? row.email ?? index}`,
            __raw: row,
          };
        }),
      ),
    [results, nameBySlug],
  );

  const rows = useMemo(
    () => (kind ? people.filter((p) => p.__kind === kind) : people),
    [people, kind],
  );

  const failedSources = results.filter((r) => r.error);

  return (
    <>
      <PageHeader
        title="People"
        description="Everyone the platform knows: admins, business accounts, customers, tourists, and claimants."
        actions={<Button onClick={reload} disabled={loading}>Refresh</Button>}
      />

      {error && <ErrorState error={error} onRetry={reload} />}

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="Total records" value={loading ? '…' : people.length} tone="primary" />
        {results.map(({ source, rows: sourceRows, error: sourceError }) => (
          <Stat
            key={source.id}
            label={source.label}
            value={sourceError ? '—' : sourceRows.length}
            tone={sourceError ? 'neutral' : source.tone}
            hint={sourceError ? (sourceError.isMissingEndpoint ? 'route not deployed' : sourceError.message) : undefined}
          />
        ))}
      </div>

      {failedSources.length > 0 && (
        <>
          <Card title="Sources that did not load">
            <ul className="stack-sm" style={{ margin: 0, paddingLeft: 18 }}>
              {failedSources.map(({ source, error: sourceError }) => (
                <li key={source.id} className="muted">
                  <strong>{source.label}</strong> — {sourceError.message}{' '}
                  <span className="mono faint">({sourceError.path})</span>
                </li>
              ))}
            </ul>
          </Card>
          <div style={{ height: 'var(--space-5)' }} />
        </>
      )}

      <Card padded={false}>
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <DataTable
            columns={[
              {
                key: '__kindLabel',
                header: 'Kind',
                render: (row) => <Badge tone={row.__tone}>{row.__kindLabel}</Badge>,
              },
              {
                key: 'name',
                header: 'Name',
                render: (row) => (
                  <div>
                    <div className="ui-cell-primary">
                      {row.name || <span className="faint">unnamed</span>}
                    </div>
                    {row.email && <div className="ui-cell-sub">{row.email}</div>}
                  </div>
                ),
              },
              columns.text('phone', 'Phone'),
              columns.text('role', 'Role'),
              {
                key: '__business',
                header: 'Business',
                stopPropagation: true,
                render: (row) =>
                  row.slug ? (
                    <Link to={`/directory/entity/${encodeURIComponent(row.slug)}`}>
                      {row.__business}
                    </Link>
                  ) : (
                    <span className="faint">—</span>
                  ),
              },
              columns.text('extra', 'Detail'),
              {
                key: 'created_at',
                header: 'First seen',
                render: (row) => formatDateTime(row.created_at) || <span className="faint">—</span>,
              },
            ]}
            rows={rows}
            loading={loading}
            rowKey="__key"
            searchPlaceholder="Search by name, email, phone, or business…"
            emptyTitle="No people"
            emptyDescription="None of the people sources returned any records."
            initialSort={{ key: 'created_at', direction: 'desc' }}
            toolbar={
              <select
                className="ui-input ui-input--select"
                style={{ width: 'auto' }}
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="">Everyone</option>
                {SOURCES.map((source) => (
                  <option key={source.id} value={source.id}>{source.label}</option>
                ))}
              </select>
            }
          />
        </div>
      </Card>
    </>
  );
}
