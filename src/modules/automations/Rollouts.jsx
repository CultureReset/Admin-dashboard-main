/**
 * Rollouts — every push to every business.
 *
 * GET /api/admin/automations/deployments/recent
 *
 * One row per deploy: which automation, which version, to whom, and how it
 * went. The "cloud update" ledger. Rolling back is a push of an older
 * version, done from the builder.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { useAsync } from '../../hooks/useAsync.js';
import { PageHeader, Card, Badge, Button, LoadingBlock, ErrorState, EmptyState, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { formatDateTime } from '../../lib/fields.jsx';
import './automations.css';

export function describeAudience(audience) {
  if (!audience) return '—';
  switch (audience.mode) {
    case 'all': return 'Every active business';
    case 'owners': return 'Businesses with a login';
    case 'industries': return `Industries: ${(audience.industries || []).join(', ')}`;
    case 'slugs': return `${(audience.slugs || []).length} named business${(audience.slugs || []).length === 1 ? '' : 'es'}`;
    default: return audience.mode;
  }
}

export default function Rollouts() {
  const query = useAsync(async () => api.get(endpoints.automations.deployments(), { query: { limit: 200 } }), [], { initialData: null });
  const rows = useMemo(() => query.data?.deployments || [], [query.data]);

  const totals = useMemo(() => rows.reduce((acc, d) => {
    acc.installed += d.installed || 0;
    acc.updated += d.updated || 0;
    acc.failed += d.failed || 0;
    return acc;
  }, { installed: 0, updated: 0, failed: 0 }), [rows]);

  const columns = useMemo(() => [
    { key: 'created_at', header: 'When', sortable: true, render: (d) => formatDateTime(d.created_at) },
    {
      key: 'automation_name',
      header: 'Automation',
      searchable: true,
      render: (d) => (
        <div className="au__name">
          <span className="au__name-icon">{d.automation_icon || '⚡'}</span>
          <div className="au__name-text">
            <Link to={`/automations/build/${d.automation_id}`}>{d.automation_name || d.automation_id}</Link>
            <span className="au__name-sub">
              pushed v{d.version}
              {d.latest_version != null && d.latest_version !== d.version && ` · latest is v${d.latest_version}`}
            </span>
          </div>
        </div>
      ),
    },
    { key: 'audience', header: 'To', value: (d) => describeAudience(d.audience), render: (d) => describeAudience(d.audience) },
    { key: 'targeted', header: 'Targeted', align: 'right' },
    { key: 'installed', header: 'New', align: 'right' },
    { key: 'updated', header: 'Updated', align: 'right' },
    {
      key: 'failed',
      header: 'Result',
      render: (d) => d.failed
        ? <Badge tone="danger">{d.failed} failed</Badge>
        : <Badge tone={d.status === 'done' ? 'success' : 'warning'}>{d.status}</Badge>,
    },
    { key: 'notes', header: 'Notes', render: (d) => d.notes || <span className="faint">—</span> },
  ], []);

  return (
    <div>
      <PageHeader
        title="Rollouts"
        description="Every version pushed to every business, newest first."
        actions={<Button onClick={() => query.reload()}>Refresh</Button>}
      />

      <div className="au__stats">
        <Stat label="Pushes" value={rows.length} />
        <Stat label="New installs" value={totals.installed} />
        <Stat label="Updated" value={totals.updated} />
        <Stat label="Failed" value={totals.failed} tone={totals.failed ? 'danger' : 'neutral'} />
      </div>

      <Card title="Deployment ledger">
        {query.loading && <LoadingBlock label="Loading rollouts…" />}
        {query.error && <ErrorState error={query.error} onRetry={query.reload} context="rollouts" />}
        {!query.loading && !query.error && (
          rows.length
            ? <DataTable columns={columns} rows={rows} pageSize={25} searchable searchPlaceholder="Search by automation…" />
            : <EmptyState icon="🚀" title="Nothing pushed yet" description="Publish an automation and push it from its builder." />
        )}
      </Card>
    </div>
  );
}
