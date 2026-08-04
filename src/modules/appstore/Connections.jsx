/**
 * The App Store catalogue — what businesses are offered.
 *
 * GET  /api/admin/connections/catalog
 * POST /api/admin/connections/sync        pull everything Composio has
 * PUT  /api/admin/connections/catalog/:id offer it, or stop offering it
 * GET  /api/admin/connections/status      can this server reach Composio
 *
 * Same AppStoreView the business dashboard renders. It takes onToggleOffer
 * here instead of the connect handlers, which is the only difference between
 * the operator's catalogue and a business's store — the component itself is
 * the same file in both repos.
 *
 * Composio carries over a thousand toolkits. Syncing brings them all in
 * switched off; this screen is where you decide which ones a business ever
 * sees.
 */

import { useCallback, useMemo, useState } from 'react';
import { Button, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { useConfirm } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import AppStoreView from '../../components/AppStoreView.jsx';
import './Connections.css';

export default function Connections() {
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);
  const [confirm, confirmElement] = useConfirm();

  const catalogue = useAsync(async () => api.get(endpoints.connections.catalog()), [], { initialData: null });
  const status = useAsync(async () => api.get(endpoints.connections.status()), [], { initialData: null });

  const tools = catalogue.data?.tools || [];
  const categories = catalogue.data?.categories || [];
  const offered = useMemo(() => tools.filter((t) => t.is_active).length, [tools]);
  const configured = catalogue.data?.composio_configured;

  const toggleOffer = useCallback(
    async (tool) => {
      try {
        await api.put(endpoints.connections.catalogItem(tool.tool_id), { is_active: !tool.is_active });
        await catalogue.reload();
      } catch (err) {
        toast.error(err);
      }
    },
    [catalogue, toast],
  );

  const sync = async () => {
    const ok = await confirm({
      title: 'Pull the catalogue from Composio',
      message:
        'Brings in every toolkit Composio offers. New ones arrive switched off, and nothing you have already offered or hidden is changed.',
      confirmLabel: 'Sync',
    });
    if (!ok) return;
    setSyncing(true);
    try {
      const result = await api.post(endpoints.connections.sync(), {});
      toast.success(`${result.synced} toolkits · ${result.new} new · ${result.categories} categories.`);
      await catalogue.reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <PageHeader
        title="App Store"
        description="Everything Composio offers. Switch on what a business should see."
        actions={
          <>
            <Button onClick={catalogue.reload} disabled={catalogue.loading}>Refresh</Button>
            <Button variant="primary" onClick={sync} loading={syncing} disabled={!configured}>
              Sync from Composio
            </Button>
          </>
        }
      />

      {catalogue.data && !configured && (
        <Notice tone="warning" title="Composio is not configured on the server">
          Set <code className="mono">COMPOSIO_API_KEY</code> on gcr-api-clean and redeploy. Until then the
          catalogue can be browsed and curated, but nothing can be synced or connected.
        </Notice>
      )}
      {status.data && status.data.configured && !status.data.reachable && (
        <Notice tone="danger" title="Composio is configured but unreachable">
          {status.data.reason}
        </Notice>
      )}
      {catalogue.data && configured && tools.length === 0 && (
        <Notice tone="info" title="The catalogue is empty">
          Sync from Composio to pull in the toolkits. They arrive switched off — switch on the ones you
          want businesses to see.
        </Notice>
      )}

      <div className="grid-auto" style={{ margin: 'var(--space-5) 0' }}>
        <Stat label="Offered to businesses" value={offered} tone={offered ? 'primary' : 'neutral'} />
        <Stat label="In the catalogue" value={tools.length} />
        <Stat label="Categories" value={categories.length} />
      </div>

      <div className="appstore-host">
        <AppStoreView
          title="Catalogue"
          subtitle={<><b>{offered}</b> of {tools.length} offered to businesses</>}
          tools={tools}
          categories={categories}
          perPage={24}
          loading={catalogue.loading}
          error={catalogue.error ? String(catalogue.error.message || catalogue.error) : ''}
          onToggleOffer={toggleOffer}
          onRetry={catalogue.reload}
        />
      </div>

      {confirmElement}
    </>
  );
}
