/**
 * Third-party integrations.
 *
 * The legacy dashboard wrote connection settings to /api/admin/set-connection,
 * which is absent from gcr-api-clean. What the API does expose is which
 * integration routers are mounted, so this screen reports each integration's
 * real availability by probing its own endpoint, and is honest that the
 * credentials themselves live in the server's environment.
 */

import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader, Spinner, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns } from '../../lib/fields.jsx';
import './Integrations.css';

/**
 * Each integration names a cheap endpoint that only responds if its router is
 * mounted. A 401/403 still proves the route exists — it just needs auth.
 */
const INTEGRATIONS = [
  { id: 'stripe', name: 'Stripe', purpose: 'Payments and Connect payouts', probe: '/api/stripe/config' },
  { id: 'square', name: 'Square', purpose: 'In-person payments', probe: '/api/square/config' },
  { id: 'fareharbor', name: 'FareHarbor', purpose: 'Activity booking sync', probe: '/api/integrations/fareharbor/status' },
  { id: 'sms', name: 'SMS', purpose: 'Outbound text messaging', probe: '/api/sms/qr-codes' },
  // Probe ai-config, not /api/ai-provider — the latter is POST /call only, so
  // a GET would report "not mounted" for a router that is in fact mounted.
  { id: 'ai', name: 'AI providers', purpose: 'Model routing', probe: '/api/admin/ai-config' },
  { id: 'analytics', name: 'Analytics', purpose: 'Pageview and event tracking', probe: '/api/analytics/stats' },
  { id: 'qr', name: 'QR codes', purpose: 'Scan tracking and redirects', probe: '/api/qr/stats/summary' },
  { id: 'platform', name: 'Booking engine', purpose: 'Universal booking records', probe: '/api/admin/platform/summary' },
  { id: 'composio', name: 'Composio', purpose: 'Third-party account connections', probe: '/api/admin/connections/status' },
];

/**
 * Providers the platform knows how to talk to but has no code for yet, so the
 * absence is visible rather than looking like an oversight.
 */
const NOT_BUILT = [
  { name: 'Peek Pro', purpose: 'Activity booking sync', note: 'No integration exists in the API.' },
];

export default function Integrations() {
  const toast = useToast();
  const [statuses, setStatuses] = useState({});
  const [probing, setProbing] = useState(false);

  // Which businesses have actually connected something. FareHarbor writes to
  // the shared `integrations` table via routes/fareharbor.js, so this answers
  // "what is this business using?" per business rather than per router.
  const connectedQuery = useAsync(
    async () =>
      unwrapList(await api.get(endpoints.bookingPlatform.integrations()), ['integrations']),
    [],
    { initialData: [] },
  );

  const connected = connectedQuery.data || [];
  const byProvider = connected.reduce((acc, row) => {
    acc[row.provider] = (acc[row.provider] || 0) + 1;
    return acc;
  }, {});

  const probeAll = useCallback(async () => {
    setProbing(true);
    const next = {};
    await Promise.all(
      INTEGRATIONS.map(async (integration) => {
        try {
          await api.get(integration.probe);
          next[integration.id] = { state: 'available' };
        } catch (err) {
          if (err.isAuthError) next[integration.id] = { state: 'available', note: 'requires auth' };
          else if (err.isMissingEndpoint) next[integration.id] = { state: 'missing' };
          else if (err.isNetworkError) next[integration.id] = { state: 'unreachable' };
          else next[integration.id] = { state: 'error', note: `${err.status}` };
        }
      }),
    );
    setStatuses(next);
    setProbing(false);
    toast.info(
      `${Object.values(next).filter((s) => s.state === 'available').length} of ${INTEGRATIONS.length} routers responded.`,
      'Probe complete',
    );
  }, [toast]);

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Which third-party routers the API is actually serving."
        actions={
          <Button variant="primary" loading={probing} onClick={probeAll}>
            Check availability
          </Button>
        }
      />

      <Notice tone="info" title="Credentials live on the server">
        API keys and secrets are environment variables on the API, never stored or shown here.
        This screen reports which integration routes are mounted, and which businesses have
        actually connected something.
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat
          label="Businesses connected"
          value={connectedQuery.loading ? '…' : connected.length}
          tone="primary"
        />
        {Object.entries(byProvider).map(([provider, count]) => (
          <Stat key={provider} label={provider} value={count} tone="success" />
        ))}
        {!connectedQuery.loading && connected.length === 0 && (
          <Stat label="Providers in use" value={0} hint="Nothing connected yet" />
        )}
      </div>

      <Card
        padded={false}
        title="Connected businesses"
        actions={<Button size="sm" onClick={connectedQuery.reload}>Reload</Button>}
      >
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          {connectedQuery.loading && <LoadingBlock />}
          {connectedQuery.error && (
            <ErrorState error={connectedQuery.error} onRetry={connectedQuery.reload} />
          )}
          {!connectedQuery.loading && !connectedQuery.error && connected.length === 0 && (
            <EmptyState
              icon="🔌"
              title="No provider connections"
              description="No business has connected FareHarbor or another provider. Composio connections live under Booking Platform → Connections."
            />
          )}
          {!connectedQuery.loading && connected.length > 0 && (
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
              rows={connected}
              rowKey={(row, index) => row.id ?? index}
              searchPlaceholder="Search connected businesses…"
            />
          )}
        </div>
      </Card>

      <div style={{ height: 'var(--space-5)' }} />

      <Card title="Integration status" subtitle="Press “Check availability” to probe each router.">
        <div className="integrations">
          {INTEGRATIONS.map((integration) => {
            const status = statuses[integration.id];
            return (
              <div className="integration" key={integration.id}>
                <div className="integration__body">
                  <div className="integration__name">{integration.name}</div>
                  <div className="integration__purpose">{integration.purpose}</div>
                  <div className="integration__probe mono">{integration.probe}</div>
                </div>
                <div className="integration__status">
                  {probing && !status ? (
                    <Spinner size={14} />
                  ) : !status ? (
                    <Badge>Not checked</Badge>
                  ) : status.state === 'available' ? (
                    <Badge tone="success">Available{status.note ? ` · ${status.note}` : ''}</Badge>
                  ) : status.state === 'missing' ? (
                    <Badge tone="warning">Not mounted</Badge>
                  ) : status.state === 'unreachable' ? (
                    <Badge tone="danger">Unreachable</Badge>
                  ) : (
                    <Badge tone="danger">Error {status.note}</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div style={{ height: 'var(--space-5)' }} />

      <Card title="Not built yet" subtitle="Providers with no integration in the API.">
        <div className="integrations">
          {NOT_BUILT.map((item) => (
            <div className="integration" key={item.name}>
              <div className="integration__body">
                <div className="integration__name">{item.name}</div>
                <div className="integration__purpose">{item.purpose}</div>
                <div className="integration__probe">{item.note}</div>
              </div>
              <div className="integration__status">
                <Badge tone="warning">Not implemented</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

    </>
  );
}
