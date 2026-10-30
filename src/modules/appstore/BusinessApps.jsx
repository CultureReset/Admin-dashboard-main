/**
 * Which module_catalog apps each business has installed (entity_modules).
 *
 * Catalog + installs:
 *   GET  /api/admin/businesses/:id/modules
 *     → { catalog|module_catalog, modules: [{ key, enabled }] }
 *   POST /api/admin/businesses/:id/modules  { key, enabled }
 *
 * Business list: GET /api/admin/businesses
 * Legacy /api/admin/apps and /api/admin/site-apps are not used.
 */

import { useMemo, useState } from 'react';
import { Badge, Button, Card, ErrorState, LoadingBlock, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Modal, useConfirm } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns } from '../../lib/fields.jsx';
import {
  catalogKey,
  catalogLabel,
  extractModules,
  fetchModuleCatalog,
  normalizeBusiness,
} from '../../lib/moduleCatalog.js';

function businessRef(business) {
  return business?.site_id || business?.id || business?.slug || business?.subdomain || '';
}

export default function BusinessApps() {
  const toast = useToast();
  const [managing, setManaging] = useState(null);
  const [confirm, confirmElement] = useConfirm();
  const [manageBusy, setManageBusy] = useState(null);

  const dataQuery = useAsync(
    async () => {
      const raw = unwrapList(await api.get(endpoints.businesses.list()), ['businesses']);
      const businesses = raw.map(normalizeBusiness).filter((b) => b && businessRef(b));

      let catalog = [];
      const seedId = businesses[0] ? businessRef(businesses[0]) : '';
      if (seedId) {
        catalog = await fetchModuleCatalog(api, endpoints, seedId);
      }

      const installsEntries = await Promise.all(
        businesses.map(async (business) => {
          const id = businessRef(business);
          try {
            const data = await api.get(endpoints.businesses.modules(id));
            const enabled = extractModules(data)
              .filter((m) => m && m.enabled !== false)
              .map((m) => ({
                key: m.key || m.module_key || m.app_id,
                enabled: true,
              }))
              .filter((m) => m.key);
            return [id, enabled];
          } catch {
            return [id, []];
          }
        }),
      );
      const installsById = Object.fromEntries(installsEntries);

      return { businesses, catalog, installsById };
    },
    [],
    { initialData: { businesses: [], catalog: [], installsById: {} } },
  );

  const businesses = dataQuery.data?.businesses || [];
  const catalog = dataQuery.data?.catalog || [];
  const installsById = dataQuery.data?.installsById || {};

  const rows = useMemo(
    () =>
      businesses.map((business) => {
        const id = businessRef(business);
        const installed = installsById[id] || [];
        return {
          ...business,
          __id: id,
          __installed: installed,
          __count: installed.length,
        };
      }),
    [businesses, installsById],
  );

  const totalInstalls = rows.reduce((sum, row) => sum + row.__count, 0);

  const setEnabled = async (business, key, enabled) => {
    const id = businessRef(business);
    if (!id || !key) return;
    setManageBusy(key);
    try {
      await api.post(endpoints.businesses.modules(id), { key, enabled });
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
    ? rows.find((row) => row.__id === businessRef(managing))
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
        description="module_catalog installs per business (entity_modules via gcr-api-clean)."
        actions={
          <Button onClick={() => dataQuery.reload()}>
            Refresh
          </Button>
        }
      />

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="Businesses" value={businesses.length} />
        <Stat label="Total installs" value={totalInstalls} tone="primary" />
        <Stat label="Apps in catalogue" value={catalog.length} />
      </div>

      <Card padded={false}>
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          {dataQuery.error && <ErrorState error={dataQuery.error} onRetry={dataQuery.reload} />}
          <DataTable
            columns={[
              columns.primary('name', 'Business', 'slug'),
              {
                key: '__installed',
                header: 'Installed apps',
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
            loading={dataQuery.loading}
            error={dataQuery.error}
            onRetry={dataQuery.reload}
            searchPlaceholder="Search businesses…"
            emptyTitle="No businesses"
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
              return (
                <li className="sec-editor__item" key={key}>
                  <div className="sec-editor__itembody">
                    <div className="sec-editor__itemname">
                      {app.icon ? `${app.icon} ` : ''}
                      {catalogLabel(app)}
                      {isInstalled && <Badge tone="success">Installed</Badge>}
                      {app.active === false && <Badge tone="warning">Unlisted</Badge>}
                      {app.is_core ? <Badge>Core</Badge> : null}
                    </div>
                    <div className="sec-editor__itemdesc">{app.description}</div>
                    <code className="mono" style={{ fontSize: '0.75rem' }}>{key}</code>
                  </div>
                  {isInstalled ? (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => uninstall(current, key)}
                    >
                      {busy ? '…' : 'Uninstall'}
                    </Button>
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
            {catalog.length === 0 && <p className="muted">The module catalog is empty.</p>}
          </ul>
        )}
      </Modal>

      {confirmElement}
    </>
  );
}
