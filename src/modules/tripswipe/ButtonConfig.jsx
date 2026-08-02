/**
 * Trip Swipe button config.
 *
 * GET /api/admin/trip-swipe-button → { type, label, url }
 *
 * The API exposes this as read-only — there is no PUT route — so the values
 * are shown with a note explaining they come from the server's environment.
 */

import { Badge, Button, Card, ErrorState, LoadingBlock, Notice, PageHeader } from '../../ui/primitives.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';

export default function ButtonConfig() {
  const { data, loading, error, reload } = useAsync(
    async () => api.get(endpoints.tripswipe.buttonConfig()),
    [],
    { initialData: null },
  );

  return (
    <>
      <PageHeader
        title="Button config"
        description="How the Trip Swipe entry point renders on the public site."
        actions={<Button onClick={reload} disabled={loading}>Refresh</Button>}
      />

      <Notice tone="info" title="Read-only">
        The API serves this configuration but has no route to change it — the URL comes from the{' '}
        <code className="mono">TRIP_SWIPE_URL</code> environment variable on the server. Change it
        there and redeploy.
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <Card title="Current configuration">
        {loading && <LoadingBlock />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {!loading && !error && data && (
          <div className="stack">
            <div className="row-wrap">
              <Badge tone="info">{data.type || 'unknown type'}</Badge>
              <strong>{data.label}</strong>
            </div>
            {data.url && (
              <div>
                <div className="ui-field__label">Destination</div>
                <a href={data.url} target="_blank" rel="noreferrer noopener" className="mono">
                  {data.url}
                </a>
              </div>
            )}
            <div>
              <div className="ui-field__label">Raw response</div>
              <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0, overflowX: 'auto' }}>
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
