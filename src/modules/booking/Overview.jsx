/**
 * Booking platform overview.
 *
 * One call — GET /api/admin/platform/summary — returns the headline counts,
 * for all businesses or one. Below it, the integrations table answers "what is
 * this business actually connected to?".
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, formatNumber } from '../../lib/fields.jsx';

const TILES = [
  { key: 'bookings', label: 'Bookings', tone: 'primary' },
  { key: 'upcoming_bookings', label: 'Upcoming', tone: 'success' },
  { key: 'pending_bookings', label: 'Pending', tone: 'warning' },
  { key: 'offerings', label: 'Offerings', tone: 'neutral' },
  { key: 'active_offerings', label: 'Bookable', tone: 'success' },
  { key: 'calendar_entries', label: 'Calendar entries', tone: 'neutral' },
  { key: 'promos', label: 'Promos', tone: 'neutral' },
  { key: 'waivers', label: 'Waivers', tone: 'neutral' },
];

export default function BookingOverview() {
  const [slug, setSlug] = useState(null);

  const summaryQuery = useAsync(
    async () => api.get(endpoints.bookingPlatform.summary(), { query: { slug: slug || undefined } }),
    [slug],
    { initialData: null },
  );

  const integrationsQuery = useAsync(
    async () =>
      unwrapList(await api.get(endpoints.bookingPlatform.integrations()), ['integrations']),
    [],
    { initialData: [] },
  );

  const summary = summaryQuery.data || {};
  const integrations = useMemo(() => {
    const rows = integrationsQuery.data || [];
    return slug ? rows.filter((r) => r.entity_slug === slug) : rows;
  }, [integrationsQuery.data, slug]);

  const refresh = () => {
    summaryQuery.reload();
    integrationsQuery.reload();
  };

  return (
    <>
      <PageHeader
        title="Booking platform"
        description="Boat rentals, fishing charters, dolphin cruises, stays — one engine, one booking table."
        actions={<Button onClick={refresh} disabled={summaryQuery.loading}>Refresh</Button>}
      />

      <Card title="Scope" subtitle="Leave the business blank to see the whole platform.">
        <EntityPicker value={slug} onChange={setSlug} label={null} placeholder="All businesses…" />
      </Card>

      <div style={{ height: 'var(--space-5)' }} />

      {summaryQuery.error && <ErrorState error={summaryQuery.error} onRetry={summaryQuery.reload} />}
      {summaryQuery.loading && <LoadingBlock />}

      {!summaryQuery.loading && !summaryQuery.error && (
        <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
          {TILES.map((tile) => {
            const value = summary[tile.key];
            return (
              <Stat
                key={tile.key}
                label={tile.label}
                // The API returns null for a table that does not exist yet,
                // which is different from a real zero — show that difference.
                value={value == null ? '—' : formatNumber(value)}
                tone={value ? tile.tone : 'neutral'}
                hint={value == null ? 'table not present' : undefined}
              />
            );
          })}
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <Card title="Manage" subtitle="Everything in the booking engine.">
          <div className="row-wrap" style={{ gap: 6 }}>
            <Link to="/booking/offerings" className="ui-multi__chip" style={{ textDecoration: 'none' }}>
              🛥️ Offerings
            </Link>
            <Link to="/booking/bookings" className="ui-multi__chip" style={{ textDecoration: 'none' }}>
              📖 Bookings
            </Link>
            <Link to="/booking/date-claims" className="ui-multi__chip" style={{ textDecoration: 'none' }}>
              📅 Calendar
            </Link>
            <Link to="/booking/promos" className="ui-multi__chip" style={{ textDecoration: 'none' }}>
              🎟️ Promos
            </Link>
            <Link to="/booking/connections" className="ui-multi__chip" style={{ textDecoration: 'none' }}>
              🔌 Connections
            </Link>
          </div>
        </Card>

        <Card
          title="Connected integrations"
          subtitle="What each business is wired to."
          actions={<Button size="sm" onClick={integrationsQuery.reload}>Reload</Button>}
        >
          {integrationsQuery.loading && <LoadingBlock />}
          {integrationsQuery.error && (
            <ErrorState error={integrationsQuery.error} onRetry={integrationsQuery.reload} />
          )}
          {!integrationsQuery.loading && !integrationsQuery.error && integrations.length === 0 && (
            <EmptyState
              icon="🔌"
              title="No integrations connected"
              description="Nothing has connected FareHarbor or another provider yet."
            />
          )}
          {!integrationsQuery.loading && integrations.length > 0 && (
            <DataTable
              columns={[
                {
                  key: 'provider',
                  header: 'Provider',
                  render: (row) => <Badge tone="info">{row.provider}</Badge>,
                },
                {
                  key: 'business_name',
                  header: 'Business',
                  render: (row) =>
                    row.entity_slug ? (
                      <Link to={`/directory/entity/${encodeURIComponent(row.entity_slug)}`}>
                        {row.business_name || row.entity_slug}
                      </Link>
                    ) : (
                      row.business_name || <span className="faint">—</span>
                    ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) => (
                    <Badge tone={row.status === 'connected' ? 'success' : 'warning'}>
                      {row.status}
                    </Badge>
                  ),
                },
                columns.text('fh_shortname', 'Account'),
                columns.dateTime('updated_at', 'Updated'),
              ]}
              rows={integrations}
              rowKey={(row, index) => row.id ?? index}
              dense
              searchable={integrations.length > 10}
              paginate={integrations.length > 25}
            />
          )}
        </Card>
      </div>
    </>
  );
}
