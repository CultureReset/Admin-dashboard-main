/**
 * Analytics.
 *
 * GET /api/admin/gcr/analytics
 * GET /api/admin/platform-analytics?days=N
 *
 * The response shapes are not fixed by the route, so this renders whatever
 * scalar counters and row collections come back rather than assuming a schema
 * that could quietly stop matching.
 */

import { useState } from 'react';
import { Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { formatNumber } from '../../lib/fields.jsx';

const RANGES = [7, 14, 30, 90];

export default function Analytics() {
  const [days, setDays] = useState(30);

  const gcrQuery = useAsync(async () => api.get(endpoints.analytics.gcr()), [], { initialData: null });
  const platformQuery = useAsync(
    async () => api.get(endpoints.analytics.platform(), { query: { days } }),
    [days],
    { initialData: null },
  );

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Traffic and engagement counters from the API."
        actions={
          <>
            <select
              className="ui-input ui-input--select"
              style={{ width: 'auto' }}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {RANGES.map((range) => (
                <option key={range} value={range}>Last {range} days</option>
              ))}
            </select>
            <Button
              onClick={() => {
                gcrQuery.reload();
                platformQuery.reload();
              }}
            >
              Refresh
            </Button>
          </>
        }
      />

      <div className="stack">
        <PayloadCard
          title="GCR"
          subtitle="Directory-wide counters."
          query={gcrQuery}
        />
        <PayloadCard
          title="Platform"
          subtitle={`Across the whole platform, last ${days} days.`}
          query={platformQuery}
        />
      </div>
    </>
  );
}

/**
 * Renders an arbitrary analytics payload: scalars become stat tiles, arrays
 * of objects become tables, and anything else is shown as formatted JSON.
 */
export function PayloadCard({ title, subtitle, query }) {
  const { data, loading, error, reload } = query;

  const scalars = data
    ? Object.entries(data).filter(([, value]) => value == null || typeof value !== 'object')
    : [];
  const tables = data
    ? Object.entries(data).filter(
        ([, value]) => Array.isArray(value) && value.length > 0 && typeof value[0] === 'object',
      )
    : [];
  const objects = data
    ? Object.entries(data).filter(
        ([, value]) => value && typeof value === 'object' && !Array.isArray(value),
      )
    : [];

  return (
    <Card title={title} subtitle={subtitle} actions={<Button size="sm" onClick={reload}>Reload</Button>}>
      {loading && <LoadingBlock />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && !data && (
        <EmptyState icon="📈" title="No data" description="The API returned an empty response." />
      )}

      {!loading && !error && data && (
        <div className="stack">
          {scalars.length > 0 && (
            <div className="grid-auto">
              {scalars.map(([key, value]) => (
                <Stat
                  key={key}
                  label={key.replace(/_/g, ' ')}
                  value={typeof value === 'number' ? formatNumber(value) : String(value ?? '—')}
                />
              ))}
            </div>
          )}

          {tables.map(([key, rows]) => (
            <div key={key}>
              <h3 style={{ fontSize: 13, marginBottom: 'var(--space-2)' }} className="muted">
                {key.replace(/_/g, ' ')}
              </h3>
              <DataTable
                columns={Object.keys(rows[0])
                  .filter((column) => typeof rows[0][column] !== 'object')
                  .slice(0, 8)
                  .map((column) => ({ key: column, header: column.replace(/_/g, ' ') }))}
                rows={rows}
                rowKey={(_, index) => index}
                dense
                searchable={rows.length > 12}
                paginate={rows.length > 25}
              />
            </div>
          ))}

          {objects.length > 0 && (
            <details>
              <summary className="muted" style={{ cursor: 'pointer', fontSize: 12.5 }}>
                Raw nested values ({objects.map(([key]) => key).join(', ')})
              </summary>
              <pre className="mono" style={{ whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
                {JSON.stringify(Object.fromEntries(objects), null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}
