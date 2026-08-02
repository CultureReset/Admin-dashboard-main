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
import { Badge, Button, Card, Notice, PageHeader, Spinner } from '../../ui/primitives.jsx';
import { ConfigCard } from '../../components/ConfigCard.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { fields } from '../../lib/fields.jsx';
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
  { id: 'ai', name: 'AI providers', purpose: 'Model routing', probe: '/api/ai-provider' },
  { id: 'analytics', name: 'Analytics', purpose: 'Pageview and event tracking', probe: '/api/analytics/stats' },
  { id: 'qr', name: 'QR codes', purpose: 'Scan tracking and redirects', probe: '/api/qr/stats/summary' },
  { id: 'platform', name: 'Booking engine', purpose: 'Universal booking records', probe: '/api/platform/registry' },
];

const connectionSchema = [
  fields.text('provider', 'Provider', { required: true, span: 2 }),
  fields.text('account_id', 'Account ID'),
  fields.bool('enabled', 'Enabled'),
  fields.textarea('notes', 'Notes', { rows: 3 }),
];

export default function Integrations() {
  const toast = useToast();
  const [statuses, setStatuses] = useState({});
  const [probing, setProbing] = useState(false);

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
        This screen reports which integration routes are mounted and reachable.
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

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

      <ConfigCard
        title="Connection settings"
        subtitle="The legacy dashboard's per-provider connection record."
        schema={connectionSchema}
        getPath={() => endpoints.unverified.setConnection()}
        method="POST"
        responseKeys={['connection']}
        unavailableHint="This route was called by the previous dashboard but is not part of the current API."
      />
    </>
  );
}
