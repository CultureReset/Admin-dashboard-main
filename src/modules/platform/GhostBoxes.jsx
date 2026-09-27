/**
 * The fleet.
 *
 * Every Ghost box at every business, read from /api/admin/ghost. One login
 * owns one box which drives one phone; this page is the operator's view
 * across all of them: what release each box runs (the installed commit the
 * box reports on its heartbeat), whether it is online, whether its core is
 * healthy, and what it has been asked.
 *
 * Read-only on purpose. Driving a box is the owner's act; an operator who
 * needs to acts as that business from the owner routes, so the trail says who.
 */

import { useState } from 'react';
import { Badge, Button, Card, ErrorState, LoadingBlock, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';

function since(iso) {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 172800) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function healthOf(node) {
  if (node.revoked_at) return <Badge tone="neutral">revoked</Badge>;
  if (!node.online) return <Badge tone="warning">offline</Badge>;
  const core = node.health?.core;
  if (core && core !== 'ok') return <Badge tone="danger">core: {core}</Badge>;
  return <Badge tone="success">online</Badge>;
}

export default function GhostBoxes() {
  const [selected, setSelected] = useState(null);
  const summary = useAsync(async () => api.get(endpoints.ghost.summary()), [], { initialData: null });
  const nodes = useAsync(async () => api.get(endpoints.ghost.nodes()), [], { initialData: null });
  const activity = useAsync(
    async () => (selected ? api.get(endpoints.ghost.requests(selected.id)) : { requests: [] }),
    [selected?.id],
    { initialData: { requests: [] } },
  );

  const rows = Array.isArray(nodes.data?.nodes) ? nodes.data.nodes : [];
  const s = summary.data || {};
  const releases = Array.isArray(s.releases) ? s.releases : [];
  const notSetUp = nodes.error?.status === 501;

  const reload = () => {
    summary.reload();
    nodes.reload();
  };

  return (
    <>
      <PageHeader
        title="Ghost boxes"
        description="The fleet: every box, the release it runs, whether it is online."
        actions={<Button onClick={reload} disabled={nodes.loading}>Refresh</Button>}
      />

      {notSetUp && (
        <Notice tone="warning" title="Ghost nodes are not set up on this database yet">
          <p>Run <code>sql/ghost_nodes.sql</code> from gcr-api-clean on the live project.</p>
        </Notice>
      )}

      {!notSetUp && (
        <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
          <Stat label="Boxes" value={s.boxes ?? '—'} />
          <Stat label="Online" value={s.online ?? '—'} tone={s.online ? 'success' : 'neutral'} />
          <Stat label="Businesses" value={s.businesses ?? '—'} />
          <Stat label="Unhealthy core" value={s.unhealthy ?? '—'} tone={s.unhealthy ? 'danger' : 'neutral'} />
          <Stat label="Releases in the field" value={releases.length} hint={releases.map((r) => `${r.version} ×${r.boxes}`).join(' · ') || undefined} />
        </div>
      )}

      {nodes.loading && <LoadingBlock />}
      {nodes.error && !notSetUp && <ErrorState error={nodes.error} onRetry={reload} />}

      {!nodes.loading && !nodes.error && (
        <Card padded={false} title="Boxes">
          <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
            <DataTable
              columns={[
                { key: 'business_name', header: 'Business', render: (r) => <span className="ui-cell-primary">{r.business_name || r.entity_slug}</span> },
                { key: 'name', header: 'Box' },
                { key: 'version', header: 'Release', render: (r) => <span className="mono">{r.version || '—'}</span> },
                { key: 'online', header: 'State', render: healthOf },
                { key: 'last_seen_at', header: 'Last seen', render: (r) => <span className="faint">{since(r.last_seen_at)}</span> },
                { key: 'token_hint', header: 'Token', render: (r) => <span className="mono faint">…{r.token_hint}</span> },
              ]}
              rows={rows}
              rowKey="id"
              onRowClick={(r) => setSelected(r)}
              searchPlaceholder="Search boxes, businesses, releases…"
              emptyTitle="No boxes enrolled yet"
              emptyDescription="A business enrols its box from the dashboard: My Ghost → Enrol a box."
              initialSort={{ key: 'last_seen_at', direction: 'desc' }}
            />
          </div>
        </Card>
      )}

      {selected && (
        <>
          <div style={{ height: 'var(--space-5)' }} />
          <Card
            padded={false}
            title={`Activity: ${selected.name} at ${selected.business_name || selected.entity_slug}`}
            actions={<Button onClick={() => setSelected(null)}>Close</Button>}
          >
            <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
              <DataTable
                columns={[
                  { key: 'created_at', header: 'Asked', render: (r) => <span className="faint">{since(r.created_at)}</span> },
                  { key: 'method', header: 'Method' },
                  { key: 'path', header: 'Path', render: (r) => <span className="mono">{r.path}</span> },
                  { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'done' ? 'success' : r.status === 'failed' ? 'danger' : 'neutral'}>{r.status}</Badge> },
                  { key: 'response_status', header: 'Box replied', render: (r) => <span className="mono">{r.response_status ?? '—'}</span> },
                ]}
                rows={Array.isArray(activity.data?.requests) ? activity.data.requests : []}
                rowKey="id"
                loading={activity.loading}
                searchable={false}
                paginate={false}
                dense
                emptyTitle="Nothing asked of this box yet"
              />
              <p className="faint" style={{ marginTop: 'var(--space-3)' }}>
                Only the shape of each request is shown. What was asked and answered stays between the owner and their box.
              </p>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
