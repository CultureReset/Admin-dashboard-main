/**
 * Which apps each business (entity slug) has installed.
 *
 * Data sources (same as Directory — all entity slugs, not the 625-row
 * /api/admin/businesses table):
 *   GET /api/admin/gcr/entities          → full list (~4,155)
 *   GET /api/admin/entity-modules/summary → { catalog, installs_by_slug }
 * Install/uninstall: POST /api/admin/businesses/:slug/modules { key, enabled }
 */

import { useMemo, useState } from 'react';
import { Badge, Button, Card, ErrorState, LoadingBlock, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Modal, useConfirm } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns } from '../../lib/fields.jsx';
import {
  catalogKey,
  catalogLabel,
  extractCatalog,
} from '../../lib/moduleCatalog.js';

function normalizeCatalog(rows) {
  return (rows || []).map((row) => {
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
}

export default function BusinessApps() {
  const toast = useToast();
  const [managing, setManaging] = useState(null);
  const [confirm, confirmElement] = useConfirm();
  const [manageBusy, setManageBusy] = useState(null);

  const dataQuery = useAsync(
    async () => {
      const [entitiesRes, summary] = await Promise.all([
        // No limit — same as Directory /directory/businesses (paginated .range on API).
        api.get(endpoints.entities.list()),
        api.get(endpoints.entityModules.summary()),
      ]);
      const entities = Array.isArray(entitiesRes?.entities) ? entitiesRes.entities : [];
      const catalog = normalizeCatalog(extractCatalog(summary));
      const installsBySlug = summary?.installs_by_slug && typeof summary.installs_by_slug === 'object'
        ? summary.installs_by_slug
        : {};
      return {
        catalog,
        entities,
        installsBySlug,
        totalInstalls: Number(summary?.total_installs) || 0,
        slugsWithInstalls: Number(summary?.slugs_with_installs) || Object.keys(installsBySlug).length,
      };
    },
    [],
    {
      initialData: {
        catalog: [],
        entities: [],
        installsBySlug: {},
        totalInstalls: 0,
        slugsWithInstalls: 0,
      },
    },
  );

  const catalog = dataQuery.data?.catalog || [];
  const entities = dataQuery.data?.entities || [];
  const installsBySlug = dataQuery.data?.installsBySlug || {};

  const rows = useMemo(
    () =>
      entities.map((entity) => {
        const slug = entity.slug;
        const install = installsBySlug[slug] || null;
        const keys = install?.keys || [];
        return {
          ...entity,
          slug,
          name: entity.name || slug,
          __installed: keys.map((key) => ({ key })),
          __count: install?.count ?? keys.length,
        };
      }),
    [entities, installsBySlug],
  );

  const totalInstalls = dataQuery.data?.totalInstalls
    ?? rows.reduce((sum, row) => sum + row.__count, 0);

  const setEnabled = async (business, key, enabled) => {
    const slug = business?.slug;
    if (!slug || !key) return;
    setManageBusy(key);
    try {
      await api.post(endpoints.businesses.modules(slug), { key, enabled });
      toast.success(enabled ? 'App installed.' : 'App uninstalled.', enabled ? undefined : 'Removed');
      await dataQuery.reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setManageBusy(null);
    }
  };

  const uninstall = async (business, key) => {
    const label = catalog.find((a) => catalogKey(a) === key);
    const ok = await confirm({
      title: 'Uninstall app',
      message: `Remove ${catalogLabel(label) || key} from ${business.name}?`,
      confirmLabel: 'Uninstall',
    });
    if (!ok) return;
    await setEnabled(business, key, false);
  };

  const current = managing
    ? rows.find((row) => row.slug === managing.slug)
    : null;
  const installedKeys = new Set(
    (current?.__installed || []).map((entry) =>
      typeof entry === 'string' ? entry : entry.key || entry.app_id,
    ),
  );

  return (
    <>
      <PageHeader
        title="Business apps"
        description="Every business in the directory, with installs from entity_modules."
        actions={<Button onClick={() => dataQuery.reload()}>Refresh</Button>}
      />

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="Businesses" value={rows.length} />
        <Stat label="With installs" value={dataQuery.data?.slugsWithInstalls ?? 0} />
        <Stat label="Total installs" value={totalInstalls} tone="primary" />
        <Stat label="Apps in catalogue" value={catalog.length} />
      </div>

      <Card padded={false}>
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          {dataQuery.error && <ErrorState error={dataQuery.error} onRetry={dataQuery.reload} />}
          <DataTable
            columns={[
              {
                key: 'name',
                header: 'Business',
                // Search name + slug (Directory has 4k+ rows; slug search finds test-pizza etc.)
                value: (row) => `${row.name || ''} ${row.slug || ''}`,
                render: (row) => (
                  <div>
                    <div className="ui-cell-primary">{row.name || <span className="faint">—</span>}</div>
                    {row.slug && <div className="ui-cell-sub mono">{row.slug}</div>}
                  </div>
                ),
              },
              {
                key: '__installed',
                header: 'Installed apps',
                searchable: false,
                render: (row) =>
                  row.__count === 0 ? (
                    <span className="faint">None</span>
                  ) : (
                    <span className="row-wrap" style={{ gap: 4 }}>
                      {row.__installed.slice(0, 5).map((entry, index) => {
                        const key = typeof entry === 'string' ? entry : entry.key;
                        const app = catalog.find((a) => catalogKey(a) === key);
                        return <Badge key={`${key}-${index}`}>{catalogLabel(app) || key}</Badge>;
                      })}
                      {row.__count > 5 && <span className="faint">+{row.__count - 5}</span>}
                    </span>
                  ),
              },
              columns.number('__count', 'Count'),
              {
                key: '__actions',
                header: '',
                align: 'right',
                sortable: false,
                searchable: false,
                stopPropagation: true,
                render: (row) => (
                  <Button size="sm" onClick={() => setManaging(row)}>Manage</Button>
                ),
              },
            ]}
            rows={rows}
            rowKey="slug"
            loading={dataQuery.loading}
            error={dataQuery.error}
            onRetry={dataQuery.reload}
            searchPlaceholder="Search by name or slug…"
            emptyTitle="No businesses in the directory"
          />
        </div>
      </Card>

      <Modal
        open={Boolean(managing)}
        onClose={() => setManaging(null)}
        size="lg"
        title={current ? `Apps — ${current.name}` : ''}
      >
        {dataQuery.loading && <LoadingBlock />}
        {current && !dataQuery.loading && (
          <ul className="sec-editor__items">
            {catalog.map((app) => {
              const key = catalogKey(app);
              const isInstalled = installedKeys.has(key);
              const busy = manageBusy === key;
              const core = app.is_core === true;
              return (
                <li className="sec-editor__item" key={key}>
                  <div className="sec-editor__itembody">
                    <div className="sec-editor__itemname">
                      {app.icon ? `${app.icon} ` : ''}
                      {catalogLabel(app)}
                      {isInstalled && <Badge tone="success">Installed</Badge>}
                      {core ? <Badge>Core</Badge> : null}
                    </div>
                    <div className="sec-editor__itemdesc">{app.description}</div>
                  </div>
                  {isInstalled ? (
                    core ? null : (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy}
                        onClick={() => uninstall(current, key)}
                      >
                        {busy ? '…' : 'Uninstall'}
                      </Button>
                    )
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={busy}
                      onClick={() => setEnabled(current, key, true)}
                    >
                      {busy ? '…' : 'Install'}
                    </Button>
                  )}
                </li>
              );
            })}
            {catalog.length === 0 && <p className="muted">The app catalogue is empty.</p>}
          </ul>
        )}
      </Modal>

      {confirmElement}
    </>
  );
}
