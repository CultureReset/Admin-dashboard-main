/**
 * Application shell: sidebar + top bar + the routed section.
 *
 * Routes are generated from the module registry, so this file never needs to
 * change when a section is added.
 */

import { Suspense, useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar.jsx';
import { TopBar } from './TopBar.jsx';
import { modules } from '../modules/registry.js';
import { LoadingBlock, EmptyState } from '../ui/primitives.jsx';
import { SectionBoundary } from './SectionBoundary.jsx';
import './AppShell.css';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="shell">
      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div className="shell__scrim" onClick={() => setSidebarOpen(false)} role="presentation" />
      )}

      <div className="shell__main">
        <TopBar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <main className="shell__content">
          <Routes>
            {modules.map((module) => (
              <Route
                key={`${module.id}:${module.path}`}
                path={module.path}
                element={
                  <SectionBoundary moduleId={module.id} label={module.label}>
                    <Suspense fallback={<LoadingBlock label={`Loading ${module.label}…`} />}>
                      <module.Component module={module} />
                    </Suspense>
                  </SectionBoundary>
                }
              />
            ))}
            <Route
              path="*"
              element={
                <EmptyState
                  icon="🧭"
                  title="Page not found"
                  description="That section does not exist. Pick one from the sidebar."
                />
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default AppShell;
