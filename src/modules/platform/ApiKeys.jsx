/**
 * Provider keys.
 *
 * Read-only, deliberately.
 *
 * The legacy dashboard posted provider secrets to /api/admin/save-api-key,
 * which stored them in a table an admin session could read back. That is
 * strictly worse than the environment variables the API already uses: it turns
 * every admin login into a path to your Stripe secret, and a screenshot or a
 * shoulder-surf into a leak.
 *
 * So there is no write here. GET /api/admin/provider-status returns booleans
 * saying which keys the server has, plus the last four characters so two
 * accounts can be told apart — and nothing that could reconstruct a key.
 * Rotating one means changing the environment variable and redeploying.
 */

import { Link } from 'react-router-dom';
import { Badge, Button, Card, ErrorState, LoadingBlock, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';

export default function ApiKeys() {
  const { data, loading, error, reload } = useAsync(
    async () => api.get(endpoints.settings.providerStatus()),
    [],
    { initialData: null },
  );

  // Guard the shape rather than trusting it: an unexpected payload should show
  // an empty table, not take the screen down.
  const providers = Array.isArray(data?.providers) ? data.providers : [];
  const configured = providers.filter((p) => p.configured);
  const missing = providers.filter((p) => !p.configured);

  return (
    <>
      <PageHeader
        title="Provider keys"
        description="Which third-party credentials this API has."
        actions={<Button onClick={reload} disabled={loading}>Refresh</Button>}
      />

      <Notice tone="info" title="Keys are environment variables, and stay that way">
        <p>
          This screen cannot set or reveal a key. It reports whether each one is present, so you
          can tell at a glance why a feature is not working. To add or rotate one, change the
          environment variable on the API and redeploy.
        </p>
        <p style={{ marginTop: 8 }}>
          The previous dashboard let you POST keys into the database. That is not reproduced here
          on purpose — it made every admin session a way to read your production secrets.
        </p>
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      {loading && <LoadingBlock />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <>
          <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
            <Stat label="Configured" value={configured.length} tone="success" />
            <Stat
              label="Not set"
              value={missing.length}
              tone={missing.length ? 'warning' : 'neutral'}
            />
            <Stat label="Known providers" value={providers.length} />
          </div>

          <Card padded={false} title="Providers">
            <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
              <DataTable
                columns={[
                  {
                    key: 'id',
                    header: 'Provider',
                    render: (row) => <span className="ui-cell-primary">{row.id}</span>,
                  },
                  {
                    key: 'env_var',
                    header: 'Environment variable',
                    render: (row) => <span className="mono">{row.env_var}</span>,
                  },
                  {
                    key: 'configured',
                    header: 'Status',
                    render: (row) =>
                      row.configured ? (
                        <Badge tone="success">Set</Badge>
                      ) : (
                        <Badge tone="warning">Not set</Badge>
                      ),
                  },
                  {
                    key: 'fingerprint',
                    header: 'Ends with',
                    render: (row) =>
                      row.fingerprint ? (
                        <span className="mono faint">{row.fingerprint}</span>
                      ) : (
                        <span className="faint">—</span>
                      ),
                  },
                ]}
                rows={providers}
                rowKey="id"
                searchPlaceholder="Search providers…"
                emptyTitle="No providers reported"
                initialSort={{ key: 'configured', direction: 'desc' }}
              />
            </div>
          </Card>

          <div style={{ height: 'var(--space-5)' }} />

          <Card title="Related">
            <p className="muted">
              Which model handles each AI task is set in{' '}
              <Link to="/content/ai-config">AI Config</Link>. Which integration routers are
              reachable is in <Link to="/platform/integrations">Integrations</Link>. Businesses
              connect their own accounts under{' '}
              <Link to="/booking/connections">Booking Platform → Connections</Link>.
            </p>
          </Card>
        </>
      )}
    </>
  );
}
