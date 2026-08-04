/**
 * Visitor behaviour across the whole platform.
 *
 * Every number comes from a table the front end already fills. Nothing is
 * modelled, estimated or extrapolated — if it is not recorded, it is not here,
 * and the coverage panel says so out loud.
 *
 * That panel is the point of this screen as much as the numbers are. Low
 * traffic and low tracking look identical on a chart, and telling them apart
 * is the difference between "nobody visited" and "we never asked".
 *
 * GET /api/admin/analytics/platform
 * GET /api/admin/analytics/health
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { useAsync } from '../../hooks/useAsync.js';
import {
  PageHeader, Card, Stat, Notice, Button, Badge,
  LoadingBlock, ErrorState, EmptyState,
} from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Sparkline, BreakdownBars } from './charts.jsx';

const WINDOWS = [7, 30, 90, 365];

export default function Behaviour() {
  const [days, setDays] = useState(30);

  const query = useAsync(
    async () => api.get(endpoints.analytics.behaviour(), { query: { days } }),
    [days],
    { initialData: null },
  );

  const health = useAsync(
    async () => api.get(endpoints.analytics.behaviourHealth()),
    [],
    { initialData: null },
  );

  const d = query.data;
  const totals = d?.totals || {};

  const topColumns = useMemo(() => [
    {
      key: 'name',
      header: 'Business',
      sortable: true,
      searchable: true,
      render: (row) => (
        <Link to={`/directory/profile/${row.slug}`}>{row.name || row.slug}</Link>
      ),
    },
    { key: 'views', header: 'Views', sortable: true, align: 'right' },
    { key: 'clicks', header: 'Clicks', sortable: true, align: 'right' },
    {
      key: 'ctr',
      header: 'Click rate',
      align: 'right',
      sortable: true,
      value: (row) => (row.views ? row.clicks / row.views : -1),
      render: (row) =>
        row.views ? `${((row.clicks / row.views) * 100).toFixed(1)}%` : <span className="muted">—</span>,
    },
  ], []);

  return (
    <div>
      <PageHeader
        title="Visitor behaviour"
        description="What people did across every business — views, clicks, swipes and saves."
        actions={
          <>
            {WINDOWS.map((w) => (
              <Button key={w} variant={w === days ? 'primary' : 'ghost'} onClick={() => setDays(w)}>
                {w}d
              </Button>
            ))}
            <Button onClick={() => query.reload()}>Refresh</Button>
          </>
        }
      />

      {query.loading && <LoadingBlock label="Reading recorded behaviour…" />}
      {query.error && <ErrorState error={query.error} onRetry={query.reload} context="platform behaviour" />}

      {!query.loading && !query.error && d && (
        <>
          <div className="an__stats">
            <Stat label="Profile views" value={totals.page_views ?? 0} hint={`last ${d.window_days} days`} />
            <Stat label="Businesses viewed" value={totals.businesses_viewed ?? 0} />
            <Stat label="Outbound clicks" value={totals.clicks ?? 0} hint={`${totals.clicks_converted ?? 0} converted`} />
            <Stat label="Swipes" value={totals.swipes ?? 0} hint={`${totals.swipes_right ?? 0} right`} />
            <Stat label="Saves" value={totals.saves ?? 0} />
            <Stat label="Identified visitors" value={totals.identified_visitors ?? 0} hint="signed-in only" />
          </div>

          <Card title="Views per day" subtitle={`since ${d.since}`}>
            {d.views_by_day?.length ? (
              <Sparkline points={d.views_by_day.map((p) => ({ label: p.date, value: p.views }))} />
            ) : (
              <EmptyState title="No views recorded in this window" />
            )}
          </Card>

          <div style={{ height: 'var(--space-4)' }} />

          <div className="an__grid">
            <Card title="Clicks by type" subtitle="what people pressed">
              {d.clicks_by_type?.length
                ? <BreakdownBars items={d.clicks_by_type} />
                : <EmptyState title="No clicks recorded" description="Click tracking fires only on business profiles." />}
            </Card>
            <Card title="Swipes by category" subtitle="Trip Swipe">
              {d.swipes_by_category?.length
                ? <BreakdownBars items={d.swipes_by_category} />
                : <EmptyState title="No swipes in this window" />}
            </Card>
            <Card title="Most saved" subtitle="kept by a tourist">
              {d.most_saved?.length
                ? <BreakdownBars items={d.most_saved} />
                : <EmptyState title="Nothing saved in this window" />}
            </Card>
          </div>

          <div style={{ height: 'var(--space-4)' }} />

          <Card title="Most viewed businesses" subtitle="click a name to open its profile">
            <DataTable
              columns={topColumns}
              rows={d.top_businesses || []}
              pageSize={25}
              searchable
              emptyLabel="No views recorded in this window"
            />
          </Card>

          <div style={{ height: 'var(--space-4)' }} />

          <Notice tone="warning" title="What these numbers are — and are not">
            <p>{d.coverage?.page_views}</p>
            <p style={{ marginTop: 8 }}>{d.coverage?.not_tracked}</p>
          </Notice>

          {health.data?.sources && (
            <>
              <div style={{ height: 'var(--space-3)' }} />
              <Card title="Which trackers are feeding data">
                <ul className="an__sources">
                  {health.data.sources.map((s) => (
                    <li key={s.table}>
                      <code>{s.table}</code>
                      <Badge tone={s.rows > 0 ? 'success' : 'warning'}>
                        {s.error ? 'error' : `${s.rows} rows`}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <p className="an__note">{health.data.note}</p>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
