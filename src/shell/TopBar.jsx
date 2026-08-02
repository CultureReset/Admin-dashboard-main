/**
 * Top bar: sidebar toggle on mobile, current section title, API target,
 * theme toggle, and the signed-in account.
 *
 * The API target is shown deliberately — an admin editing live data should be
 * able to see at a glance which backend they are pointed at.
 */

import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { modules } from '../modules/registry.js';
import { config } from '../config/env.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useTheme } from './useTheme.js';
import { Button } from '../ui/primitives.jsx';
import './TopBar.css';

/** Find the module whose path matches the current URL. */
function useCurrentModule() {
  const { pathname } = useLocation();
  return useMemo(() => {
    // Exact match first, then the longest prefix (handles /entity/:slug).
    const exact = modules.find((m) => m.path === pathname);
    if (exact) return exact;
    const dynamic = modules
      .filter((m) => m.path.includes(':'))
      .find((m) => {
        const base = m.path.split('/:')[0];
        return pathname.startsWith(`${base}/`);
      });
    if (dynamic) return dynamic;
    return modules
      .filter((m) => m.path !== '/')
      .sort((a, b) => b.path.length - a.path.length)
      .find((m) => pathname.startsWith(m.path));
  }, [pathname]);
}

export function TopBar({ onToggleSidebar }) {
  const current = useCurrentModule();
  const { user, signOut } = useAuth();
  const [theme, toggleTheme] = useTheme();

  const apiLabel = config.apiBaseUrl || `${window.location.origin} (same origin)`;

  return (
    <header className="shell-topbar">
      <button
        type="button"
        className="shell-topbar__burger"
        onClick={onToggleSidebar}
        aria-label="Toggle navigation"
      >
        ☰
      </button>

      <div className="shell-topbar__title">
        {current?.icon && <span aria-hidden="true">{current.icon}</span>}
        <span>{current?.label || config.appName}</span>
      </div>

      <div className="spacer" />

      <span className="shell-topbar__api mono" title={`API base: ${apiLabel}`}>
        {apiLabel.replace(/^https?:\/\//, '')}
      </span>

      <Button
        size="sm"
        variant="ghost"
        onClick={toggleTheme}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </Button>

      <div className="shell-topbar__user">
        <span className="shell-topbar__email truncate">{user?.email || 'Signed in'}</span>
        <Button size="sm" variant="ghost" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    </header>
  );
}

export default TopBar;
