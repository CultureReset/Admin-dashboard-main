/**
 * Sidebar navigation, generated entirely from the module registry.
 *
 * There is no hand-written list of links here — adding a module to
 * src/modules/registry.js makes it appear.
 */

import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { navigation, modules } from '../modules/registry.js';
import { config } from '../config/env.js';
import { SearchInput } from '../ui/primitives.jsx';
import './Sidebar.css';

/**
 * Paths that are a prefix of another section's path — "/booking" sits above
 * "/booking/offerings", and "/tripswipe" above its children. Without `end`,
 * NavLink marks the parent active whenever a child is open and two items light
 * up at once. Derived rather than listed, so a new group gets it for free.
 */
const PREFIX_PATHS = new Set(
  modules
    .filter((m) => modules.some((other) => other !== m && other.path.startsWith(`${m.path}/`)))
    .map((m) => m.path),
);

export function Sidebar({ open, onNavigate }) {
  const [filter, setFilter] = useState('');

  const groups = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return navigation;
    return navigation
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(needle) ||
            item.id.toLowerCase().includes(needle) ||
            (item.description || '').toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [filter]);

  return (
    <aside className={`shell-sidebar ${open ? 'is-open' : ''}`}>
      <div className="shell-sidebar__brand">
        <span className="shell-sidebar__logo" aria-hidden="true">◈</span>
        <span className="shell-sidebar__name">{config.appShortName}</span>
      </div>

      <div className="shell-sidebar__filter">
        <SearchInput value={filter} onChange={setFilter} placeholder="Filter sections…" />
      </div>

      <nav className="shell-sidebar__nav">
        {groups.map((group) => (
          <div className="shell-nav-group" key={group.key}>
            {group.label && <div className="shell-nav-group__label">{group.label}</div>}
            {group.items.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.path === '/' || PREFIX_PATHS.has(item.path)}
                className={({ isActive }) => `shell-nav-item ${isActive ? 'is-active' : ''}`}
                onClick={onNavigate}
                title={item.description || item.label}
              >
                <span className="shell-nav-item__icon" aria-hidden="true">{item.icon}</span>
                <span className="shell-nav-item__label">{item.label}</span>
                {item.status === 'partial' && (
                  <span
                    className="shell-nav-item__flag"
                    title="Depends on an API route that is not currently deployed"
                    aria-label="Partially available"
                  >
                    !
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
        {groups.length === 0 && <p className="shell-sidebar__nomatch">No sections match “{filter}”.</p>}
      </nav>
    </aside>
  );
}

export default Sidebar;
