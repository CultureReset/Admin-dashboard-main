/**
 * Dashboard settings.
 *
 * This screen configures the dashboard itself, not the API. It shows exactly
 * where every runtime value comes from — which is the point of having a config
 * layer instead of hardcoded constants.
 */

import { useState } from 'react';
import { Badge, Button, Card, Notice, PageHeader } from '../../ui/primitives.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useTheme } from '../../shell/useTheme.js';
import { config } from '../../config/env.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { modules, navigation } from '../registry.js';

export default function Settings() {
  const toast = useToast();
  const { user, signOut } = useAuth();
  const [theme, toggleTheme] = useTheme();
  const [checking, setChecking] = useState(false);
  const [health, setHealth] = useState(null);

  const checkApi = async () => {
    setChecking(true);
    const started = performance.now();
    try {
      await api.get(endpoints.auth.verify());
      setHealth({ ok: true, ms: Math.round(performance.now() - started) });
      toast.success('The API responded and accepted your session.');
    } catch (err) {
      setHealth({ ok: false, ms: Math.round(performance.now() - started), message: err.message });
      toast.error(err);
    } finally {
      setChecking(false);
    }
  };

  const partial = modules.filter((m) => m.status === 'partial');

  const settings = [
    ['API base URL', config.apiBaseUrl || `${window.location.origin} (same origin)`, 'VITE_API_BASE_URL'],
    ['Public site URL', config.publicSiteUrl || 'not set', 'VITE_PUBLIC_SITE_URL'],
    ['Auth token key', config.authTokenKey, 'VITE_AUTH_TOKEN_KEY'],
    ['Required role', config.requiredRole, 'VITE_REQUIRED_ROLE'],
    ['App name', config.appName, 'VITE_APP_NAME'],
    ['Default page size', String(config.defaultPageSize), 'VITE_DEFAULT_PAGE_SIZE'],
    ['Request timeout', `${config.requestTimeoutMs} ms`, 'VITE_REQUEST_TIMEOUT_MS'],
  ];

  return (
    <>
      <PageHeader title="Settings" description="How this dashboard is configured." />

      <div className="stack">
        <Card title="Session">
          <div className="stack">
            <div className="row-wrap">
              <span className="muted">Signed in as</span>
              <strong>{user?.email || 'unknown'}</strong>
              {user?.role && <Badge tone="primary">{user.role}</Badge>}
            </div>
            <div className="row-wrap">
              <Button onClick={() => signOut()}>Sign out</Button>
              <Button onClick={checkApi} loading={checking}>Test the API connection</Button>
              {health && (
                <Badge tone={health.ok ? 'success' : 'danger'}>
                  {health.ok ? `OK · ${health.ms} ms` : `Failed · ${health.message}`}
                </Badge>
              )}
            </div>
          </div>
        </Card>

        <Card title="Appearance">
          <div className="row-wrap">
            <span className="muted">Theme</span>
            <Badge>{theme}</Badge>
            <Button onClick={toggleTheme}>
              Switch to {theme === 'dark' ? 'light' : 'dark'}
            </Button>
          </div>
        </Card>

        <Card
          title="Configuration"
          subtitle="Every value below is read at runtime — nothing here is compiled into the source."
        >
          <div className="ui-table__scroll">
            <table className="ui-table ui-table--dense">
              <thead>
                <tr>
                  <th>Setting</th>
                  <th>Current value</th>
                  <th>Environment variable</th>
                </tr>
              </thead>
              <tbody>
                {settings.map(([label, value, envVar]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td className="mono">{value}</td>
                    <td className="mono faint">{envVar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ height: 'var(--space-4)' }} />
          <Notice tone="info" title="Repointing without a rebuild">
            Define <code className="mono">window.__ADMIN_CONFIG__</code> before the app loads (for
            example from a small <code>config.js</code> served next to{' '}
            <code>index.html</code>) and it overrides the build-time values.
          </Notice>
        </Card>

        <Card
          title="Sections"
          subtitle={`${modules.filter((m) => !m.hidden).length} sections across ${navigation.length} groups.`}
        >
          {partial.length === 0 ? (
            <p className="muted">Every section is backed by a route the API serves.</p>
          ) : (
            <>
              <p className="muted" style={{ marginBottom: 'var(--space-3)' }}>
                {partial.length} sections depend on routes that are not currently deployed on{' '}
                <code>gcr-api-clean</code>. They are wired to the paths the previous dashboard used
                and will start working as soon as those routes exist.
              </p>
              <div className="row-wrap" style={{ gap: 6 }}>
                {partial.map((module) => (
                  <Badge tone="warning" key={module.id}>{module.label}</Badge>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
