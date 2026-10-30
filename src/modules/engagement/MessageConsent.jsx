/**
 * Formal SMS consent ledger (message_consent).
 *
 * GET /api/admin/message-consent → phones masked.
 * This is the TCPA audit trail — separate from tourist_profiles.sms_opt_in.
 */

import { Badge, Button, Card, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, formatDateTime } from '../../lib/fields.jsx';

export default function MessageConsent() {
  const { data, loading, error, reload } = useAsync(
    async () => api.get(endpoints.messageConsent.list()),
    [],
    { initialData: null },
  );

  const rows = unwrapList(data, ['consents']) || [];
  const total = data?.total ?? rows.length;
  const granted = data?.granted ?? rows.filter((r) => r.status === 'granted').length;
  const revoked = data?.revoked ?? rows.filter((r) => r.status === 'revoked').length;

  return (
    <>
      <PageHeader
        title="Message consent"
        description="Formal SMS consent ledger (message_consent). Phones are masked."
        actions={<Button onClick={reload} disabled={loading}>Refresh</Button>}
      />

      <Notice tone="info" title="Boolean vs ledger">
        <p>
          Tourist profiles may show SMS OK from <code className="mono">sms_opt_in</code> while this
          ledger is the TCPA record blasts should use. A backfill script exists on the API
          (<code className="mono">scripts/backfill-message-consent-from-sms-opt-in.js</code>) — dry-run
          only until legal review; it is not run from admin.
        </p>
      </Notice>

      <div className="grid-auto" style={{ margin: 'var(--space-5) 0' }}>
        <Stat label="Rows" value={total} />
        <Stat label="Granted" value={granted} tone="success" />
        <Stat label="Revoked" value={revoked} />
      </div>

      <Card padded={false}>
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <DataTable
            columns={[
              columns.text('phone_masked', 'Phone'),
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Badge tone={row.status === 'granted' ? 'success' : 'warning'}>
                    {row.status || '—'}
                  </Badge>
                ),
              },
              columns.text('scope', 'Scope'),
              {
                key: 'entity_slug',
                header: 'Business',
                render: (row) =>
                  row.entity_slug === '*' ? (
                    <span className="faint">universal (*)</span>
                  ) : (
                    row.entity_slug || <span className="faint">—</span>
                  ),
              },
              columns.text('method', 'Method'),
              columns.text('terms_version', 'Terms'),
              {
                key: 'recorded_at',
                header: 'Recorded',
                render: (row) => formatDateTime(row.recorded_at) || <span className="faint">—</span>,
              },
            ]}
            rows={rows}
            loading={loading}
            error={error}
            onRetry={reload}
            rowKey="id"
            searchPlaceholder="Search phone, scope, method…"
            emptyTitle="No consent rows"
            emptyDescription="Nobody has a formal message_consent grant yet."
            initialSort={{ key: 'recorded_at', direction: 'desc' }}
          />
        </div>
      </Card>
    </>
  );
}
