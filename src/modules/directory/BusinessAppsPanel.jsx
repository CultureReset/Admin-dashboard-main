/**
 * Apps panel for one business on the Business Profile screen.
 *
 * Catalog + install state come from one route:
 *   GET  /api/admin/businesses/:id/modules
 *     → { catalog|module_catalog: [{ key, name, description, … }],
 *         modules: [{ key, enabled }] }
 *   POST /api/admin/businesses/:id/modules  { key, enabled }
 *
 * Catalog rows are public.module_catalog (via gcr-api-clean). The legacy
 * empty `apps` table / GET /api/admin/apps is not used here.
 *
 * Until the modules route is live a 404 surfaces as a "pending API" notice
 * and buttons stay disabled.
 *
 * Key aliasing lives in src/lib/moduleKeys.js (mirrors Dashboards-users-
 * moduleNav.js). API catalog mappings override the local fallback when present.
 */

import { useCallback, useMemo, useState } from 'react';
import { api, ApiError } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { useAsync } from '../../hooks/useAsync.js';
import {
  keysMatch, canonicalModuleKey, applyCatalogFromApi, clearCatalogFromApi,
} from '../../lib/moduleKeys.js';
import {
  Badge, Button, Card, Notice, LoadingBlock, ErrorState, EmptyState,
} from '../../ui/primitives.jsx';
import { useToast } from '../../ui/Toast.jsx';

function catalogKey(app) {
  return app?.key || app?.module_key || app?.app_id || app?.id || '';
}

function catalogLabel(app) {
  return app?.name || app?.label || catalogKey(app) || 'App';
}

function extractCatalog(data) {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.catalog)) return data.catalog;
  if (Array.isArray(data.module_catalog)) return data.module_catalog;
  return [];
}

function extractModules(data) {
  if (Array.isArray(data?.modules)) return data.modules;
  if (Array.isArray(data)) return data;
  return [];
}

export default function BusinessAppsPanel({ businessId, onChanged }) {
  const toast = useToast();
  const [busyKey, setBusyKey] = useState(null);

  const modulesQuery = useAsync(
    async () => {
      if (!businessId) {
        clearCatalogFromApi();
        return { modules: [], catalog: [], pendingApi: false };
      }
      try {
        const data = await api.get(endpoints.businesses.modules(businessId));
        // API-provided catalog mappings override the local fallback map.
        applyCatalogFromApi(data);
        return {
          modules: extractModules(data),
          catalog: extractCatalog(data),
          pendingApi: false,
        };
      } catch (err) {
        if (err instanceof ApiError && err.isMissingEndpoint) {
          clearCatalogFromApi();
          return { modules: [], catalog: [], pendingApi: true, pendingError: err };
        }
        throw err;
      }
    },
    [businessId],
    { initialData: { modules: [], catalog: [], pendingApi: false } },
  );

  const catalog = modulesQuery.data?.catalog || [];
  const modules = modulesQuery.data?.modules || [];
  const pendingApi = Boolean(modulesQuery.data?.pendingApi);

  const installedKeys = useMemo(() => {
    const on = new Set();
    for (const m of modules) {
      if (m && m.enabled !== false) {
        const key = m.key || m.app_id || m.module_key;
        if (key) on.add(String(key));
      }
    }
    return on;
  }, [modules]);

  const isInstalled = useCallback(
    (app) => {
      const key = catalogKey(app);
      if (!key) return false;
      if (installedKeys.has(key)) return true;
      for (const installed of installedKeys) {
        if (keysMatch(key, installed)) return true;
      }
      return false;
    },
    [installedKeys],
  );

  const setEnabled = async (app, enabled) => {
    if (!businessId || pendingApi) return;
    const key = catalogKey(app);
    if (!key) return;
    // POST the catalog key; entity_modules may store the canonical form.
    const postKey = canonicalModuleKey(key) || key;
    setBusyKey(key);
    try {
      await api.post(endpoints.businesses.modules(businessId), { key: postKey, enabled });
      toast.success(enabled ? `${catalogLabel(app)} installed` : `${catalogLabel(app)} uninstalled`);
      await modulesQuery.reload();
      onChanged?.();
    } catch (err) {
      if (err instanceof ApiError && err.isMissingEndpoint) {
        toast.error('Modules API is not live yet — install is pending.');
      } else {
        toast.error(err);
      }
    } finally {
      setBusyKey(null);
    }
  };

  const loading = modulesQuery.loading;
  const hardError = modulesQuery.error && !pendingApi ? modulesQuery.error : null;

  return (
    <Card
      title="Apps"
      subtitle="module_catalog apps — install state from entity_modules"
      actions={
        <Button variant="ghost" onClick={() => modulesQuery.reload()}>
          Refresh
        </Button>
      }
    >
      {pendingApi && (
        <Notice tone="warning" title="Pending API">
          <p>
            Catalog and install state call{' '}
            <code className="mono">GET/POST /api/admin/businesses/:id/modules</code>
            {' '}on gcr-api-clean. That route is not live yet (404); buttons stay
            disabled until it is.
          </p>
        </Notice>
      )}

      {loading && <LoadingBlock label="Loading apps…" />}

      {!loading && hardError && (
        <ErrorState
          error={hardError}
          onRetry={() => modulesQuery.reload()}
          context="business apps"
        />
      )}

      {!loading && !hardError && catalog.length === 0 && (
        <EmptyState
          title="No apps in the catalog"
          description="module_catalog from the modules API is empty — nothing to install yet."
        />
      )}

      {!loading && !hardError && catalog.length > 0 && (
        <ul className="bp__apps">
          {catalog.map((app) => {
            const key = catalogKey(app);
            const installed = isInstalled(app);
            const busy = busyKey === key;
            return (
              <li className="bp__app" key={key || catalogLabel(app)}>
                <div className="bp__app-body">
                  <div className="bp__app-name">
                    {app.icon ? <span className="bp__app-icon" aria-hidden="true">{app.icon}</span> : null}
                    <span>{catalogLabel(app)}</span>
                    {installed && <Badge tone="success">Installed</Badge>}
                    {app.active === false || app.status === 'inactive' ? (
                      <Badge tone="warning">Unlisted</Badge>
                    ) : null}
                    {app.is_core ? <Badge>Core</Badge> : null}
                  </div>
                  {(app.description || app.category) && (
                    <div className="bp__app-desc">
                      {app.description || app.category}
                    </div>
                  )}
                  <code className="bp__app-key">{key}</code>
                </div>
                {installed ? (
                  app.is_core === true ? null : (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={pendingApi || busy || !businessId}
                      onClick={() => setEnabled(app, false)}
                    >
                      {busy ? '…' : 'Uninstall'}
                    </Button>
                  )
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={pendingApi || busy || !businessId}
                    onClick={() => setEnabled(app, true)}
                  >
                    {busy ? '…' : 'Install'}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
