/**
 * App catalogue (read-only).
 *
 * Lists public.module_catalog via
 *   GET /api/admin/entity-modules/summary → { catalog | module_catalog }
 *
 * The legacy empty `apps` table / GET/POST /api/admin/apps is not used.
 * Installs: Business apps / Business Profile (entity_modules).
 * Shipping: Store (/api/admin/store/*).
 */

import { Badge, Button, Card, Notice, PageHeader } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns } from '../../lib/fields.jsx';
import { catalogKey, catalogLabel, extractCatalog } from '../../lib/moduleCatalog.js';

export default function AppManager() {
  const catalogQuery = useAsync(
    async () => {
      const data = await api.get(endpoints.entityModules.summary());
      return extractCatalog(data).map((row) => {
        const key = catalogKey(row);
        return {
          ...row,
          key,
          app_id: row.app_id || key,
          name: catalogLabel(row),
          description: row.description || row.tagline || null,
          active: row.active !== false,
          is_core: row.is_core === true,
        };
      });
    },
    [],
    { initialData: [] },
  );

  const apps = catalogQuery.data || [];

  return (
    <>
      <PageHeader
        title="App manager"
        description="Apps businesses can install (module catalog)."
        actions={<Button onClick={() => catalogQuery.reload()}>Refresh</Button>}
      />

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Notice tone="info" title="Catalog from module_catalog">
          <p>
            Read-only list of installable apps. Install on <strong>Business apps</strong> or a
            business profile; ship versions from the <strong>Store</strong>.
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
            emptyDescription="module_catalog is empty."
          />
        </div>
      </Card>
    </>
  );
}
