/**
 * Tabs driven by a descriptor list.
 *
 * The Entity Editor's tab strip is a registry of tab modules, so adding a tab
 * is adding a file plus one array entry — the tab bar picks it up.
 *
 * Tab descriptor: { id, label, badge?, component, visible?: (ctx) => boolean }
 */

import { useMemo } from 'react';
import './Tabs.css';

/**
 * Just the tab strip, for screens that manage their own panel content.
 *
 * Exists so those screens stop hand-writing the markup: doing that meant
 * `Tabs.css` was never imported on a page that had no full <Tabs>, and the
 * strip rendered as unstyled grey boxes. Importing this guarantees the styles
 * come with it.
 *
 * @param {Array<{id, label, badge?, icon?}>} tabs
 */
export function TabBar({ tabs, activeId, onChange, className = '' }) {
  return (
    <div className={`ui-tabs__bar ${className}`.trim()} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === activeId}
          className={`ui-tabs__tab ${tab.id === activeId ? 'is-active' : ''}`}
          onClick={() => onChange?.(tab.id)}
        >
          {tab.icon && <span className="ui-tabs__icon" aria-hidden="true">{tab.icon}</span>}
          <span>{tab.label}</span>
          {tab.badge != null && <span className="ui-tabs__badge">{tab.badge}</span>}
        </button>
      ))}
    </div>
  );
}

export function Tabs({ tabs, activeId, onChange, context, fallback = null }) {
  const visible = useMemo(
    () => tabs.filter((tab) => (typeof tab.visible === 'function' ? tab.visible(context) : true)),
    [tabs, context],
  );

  const active = visible.find((tab) => tab.id === activeId) || visible[0];
  const ActiveComponent = active?.component;

  return (
    <div className="ui-tabs">
      <div className="ui-tabs__bar" role="tablist">
        {visible.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active?.id}
            className={`ui-tabs__tab ${tab.id === active?.id ? 'is-active' : ''}`}
            onClick={() => onChange?.(tab.id)}
          >
            {tab.icon && <span className="ui-tabs__icon" aria-hidden="true">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge != null && <span className="ui-tabs__badge">{tab.badge}</span>}
          </button>
        ))}
      </div>
      <div className="ui-tabs__panel" role="tabpanel">
        {ActiveComponent ? <ActiveComponent {...(context || {})} /> : fallback}
      </div>
    </div>
  );
}

export default Tabs;
