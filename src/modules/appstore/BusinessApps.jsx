/**
 * Which apps each business has installed.
 *
 * GET    /api/admin/businesses?include_apps=true
 * POST   /api/admin/site-apps    { site_id, app_id }
 * DELETE /api/admin/site-apps    { site_id, app_id }
 */

import { useMemo, useState } from 'react';
import { Badge, Button, Card, ErrorState, LoadingBlock, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Modal, useConfirm } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, formatMoney } from '../../lib/fields.jsx';

export default function BusinessApps() {
  const toast = useToast();
  const [managing, setManaging] = useState(null);
  const [confirm, confirmElement] = useConfirm();

  const businessesQuery = useAsync(
    async () =>
      unwrapList(await api.get(endpoints.businesses.list(), { query: { include_apps: true } }), [
        'businesses',
      ]),
    [],
    { initialData: [] },
  );

  const appsQuery = useAsync(
    async () => unwrapList(await api.get(endpoints.apps.list()), ['apps']),
    [],
    { initialData: [] },
  );

  const businesses = businessesQuery.data || [];
  const apps = appsQuery.data || [];

  const rows = useMemo(
    () =>
      businesses.map((business) => {
        const installed = business.apps || business.site_apps || [];
        return {
          ...business,
          __installed: installed,
          __count: installed.length,
          __spend: installed.reduce((sum, entry) => {
            const appId = typeof entry === 'string' ? entry : entry.app_id;
            const app = apps.find((a) => a.app_id === appId);
            return sum + Number(app?.monthly_price || 0);
          }, 0),
        };
      }),
    [businesses, apps],
  );

  const totalInstalls = rows.reduce((sum, row) => sum + row.__count, 0);
  const monthlyTotal = rows.reduce((sum, row) => sum + row.__spend, 0);

  const install = async (business, appId) => {
    try {
      await api.post(endpoints.apps.siteApps(), { site_id: business.id, app_id: appId });
      toast.success('App installed.');
      await businessesQuery.reload();
      setManaging(null);
    } catch (err) {
      toast.error(err);
    }
  };

  const uninstall = async (business, appId) => {
    const ok = await confirm({
      title: 'Uninstall app',
      message: `Remove ${appId} from ${business.name}?`,
      confirmLabel: 'Uninstall',
    });
    if (!ok) return;
    try {
      // The API takes the identifiers in the body, not the path.
      await api.del(endpoints.apps.siteApps(), {
        body: { site_id: business.id, app_id: appId },
      });
      toast.success('App uninstalled.', 'Removed');
      await businessesQuery.reload();
      setManaging(null);
    } catch (err) {
      toast.error(err);
    }
  };

  const current = managing ? rows.find((row) => row.id === managing.id) : null;
  const installedIds = (current?.__installed || []).map((entry) =>
    typeof entry === 'string' ? entry : entry.app_id,
  );

  return (
    <>
      <PageHeader
        title="Business apps"
        description="Which apps each business has installed, and what that costs them."
        actions={
          <Button
            onClick={() => {
              businessesQuery.reload();
              appsQuery.reload();
            }}
          >
            Refresh
          </Button>
        }
      />

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="Businesses" value={businesses.length} />
        <Stat label="Total installs" value={totalInstalls} tone="primary" />
        <Stat label="Monthly app revenue" value={formatMoney(monthlyTotal)} tone="success" />
        <Stat label="Apps in catalogue" value={apps.length} />
      </div>

      <Card padded={false}>
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          {appsQuery.error && <ErrorState error={appsQuery.error} onRetry={appsQuery.reload} />}
          <DataTable
            columns={[
              columns.primary('name', 'Business', 'domain'),
              {
                key: '__installed',
                header: 'Installed apps',
                render: (row) =>
                  row.__count === 0 ? (
                    <span className="faint">None</span>
                  ) : (
                    <span className="row-wrap" style={{ gap: 4 }}>
                      {row.__installed.slice(0, 5).map((entry, index) => {
                        const appId = typeof entry === 'string' ? entry : entry.app_id;
                        const app = apps.find((a) => a.app_id === appId);
                        return <Badge key={`${appId}-${index}`}>{app?.name || appId}</Badge>;
                      })}
                      {row.__count > 5 && <span className="faint">+{row.__count - 5}</span>}
                    </span>
                  ),
              },
              columns.number('__count', 'Count'),
              {
                key: '__spend',
                header: 'Monthly',
                align: 'right',
                render: (row) => formatMoney(row.__spend),
              },
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
            loading={businessesQuery.loading}
            error={businessesQuery.error}
            onRetry={businessesQuery.reload}
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
        {appsQuery.loading && <LoadingBlock />}
        {current && !appsQuery.loading && (
          <ul className="sec-editor__items">
            {apps.map((app) => {
              const isInstalled = installedIds.includes(app.app_id);
              return (
                <li className="sec-editor__item" key={app.app_id}>
                  <div className="sec-editor__itembody">
                    <div className="sec-editor__itemname">
                      {app.icon ? `${app.icon} ` : ''}
                      {app.name}
                      {isInstalled && <Badge tone="success">Installed</Badge>}
                      {!app.active && <Badge tone="warning">Unlisted</Badge>}
                    </div>
                    <div className="sec-editor__itemdesc">{app.description}</div>
                  </div>
                  <div className="sec-editor__price">{formatMoney(app.monthly_price) || 'Free'}</div>
                  {isInstalled ? (
                    <Button size="sm" variant="danger" onClick={() => uninstall(current, app.app_id)}>
                      Uninstall
                    </Button>
                  ) : (
                    <Button size="sm" variant="primary" onClick={() => install(current, app.app_id)}>
                      Install
                    </Button>
                  )}
                </li>
              );
            })}
            {apps.length === 0 && <p className="muted">The app catalogue is empty.</p>}
          </ul>
        )}
      </Modal>

      {confirmElement}
    </>
  );
}
