/**
 * App catalogue (read-only).
 *
 * Lists public.module_catalog via
 *   GET /api/admin/businesses/:id/modules → { catalog | module_catalog }
 *
 * The legacy empty `apps` table / GET/POST /api/admin/apps is not used.
 * Installs: Business apps / Business Profile (entity_modules).
 * Shipping: Store (/api/admin/store/*).
 */

import { Badge, Button, Card, Notice, PageHeader } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns } from '../../lib/fields.jsx';
import { fetchModuleCatalog, normalizeBusiness } from '../../lib/moduleCatalog.js';

export default function AppManager() {
  const catalogQuery = useAsync(
    async () => {
      const businesses = unwrapList(await api.get(endpoints.businesses.list()), ['businesses'])
        .map(normalizeBusiness)
        .filter(Boolean);
      const seed = businesses[0];
      const seedId = seed?.site_id || seed?.id || seed?.slug;
      if (!seedId) return [];
      return fetchModuleCatalog(api, endpoints, seedId);
    },
    [],
    { initialData: [] },
  );

  const apps = catalogQuery.data || [];

  return (
    <>
      <PageHeader
        title="App manager"
        description="module_catalog — the apps businesses can install."
        actions={<Button onClick={() => catalogQuery.reload()}>Refresh</Button>}
      />

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Notice tone="info" title="Catalog is module_catalog">
          <p>
            This list comes from <code className="mono">GET /api/admin/businesses/:id/modules</code>
            {' '}(<code className="mono">catalog</code> / <code className="mono">module_catalog</code>),
            not the legacy empty <code className="mono">apps</code> table. Read-only here —
            install on <strong>Business apps</strong> or a business profile; ship versions from
            the <strong>Store</strong>.
          </p>
        </Notice>
      </div>

      <Card padded={false}>
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <DataTable
            columns={[
              {
                key: 'name',
                header: 'App',
                render: (row) => (
                  <div>
                    <div className="ui-cell-primary">
                      {row.icon ? `${row.icon} ` : ''}
                      {row.name}
                      {row.is_core ? <Badge>Core</Badge> : null}
                    </div>
                    <div className="ui-cell-sub mono">{row.key || row.app_id}</div>
                  </div>
                ),
              },
              columns.text('category', 'Category'),
              columns.bool('active', 'Listed', { trueLabel: 'Listed', falseLabel: 'Hidden' }),
              {
                key: 'description',
                header: 'About',
                render: (row) => row.description || <span className="faint">—</span>,
              },
            ]}
            rows={apps}
            rowKey="key"
            loading={catalogQuery.loading}
            error={catalogQuery.error}
            onRetry={catalogQuery.reload}
            searchPlaceholder="Search apps…"
            emptyTitle="No apps in the catalog"
            emptyDescription="module_catalog is empty, or no business exists yet to resolve the modules route."
          />
        </div>
      </Card>
    </>
  );
}
