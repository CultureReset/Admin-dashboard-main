/**
 * Menu builder — menus, drinks, and happy hour for a chosen business.
 *
 * Same editors as the Entity Editor's Content tab, presented as a focused
 * screen for someone whose whole job is menus. Both use the same component,
 * so behaviour cannot drift between them.
 */

import { useState } from 'react';
import { Button, PageHeader } from '../../ui/primitives.jsx';
import { SectionedItemsEditor } from '../../components/SectionedItemsEditor.jsx';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { useEntityFull } from '../directory/useEntityFull.js';
import { endpoints } from '../../api/endpoints.js';
import { usePersistentState } from '../../hooks/useAsync.js';
import {
  menuItemSchema,
  drinkItemSchema,
  happyHourItemSchema,
  menuSectionExtraFields,
} from '../../lib/contentSchemas.js';

const LISTS = [
  { id: 'menu', label: 'Food menu' },
  { id: 'drinks', label: 'Drinks' },
  { id: 'happy-hour', label: 'Happy hour' },
];

export default function MenuBuilder() {
  const [slug, setSlug] = usePersistentState('cc_admin_entity', null);
  const [active, setActive] = useState('menu');
  const { data, loading, error, reload } = useEntityFull(slug);

  const counts = {
    menu: (data?.menu_sections || []).reduce((n, s) => n + (s.items?.length || 0), 0),
    drinks: (data?.drink_sections || []).reduce((n, s) => n + (s.items?.length || 0), 0),
    'happy-hour': (data?.happy_hour_sections || []).reduce((n, s) => n + (s.items?.length || 0), 0),
  };

  return (
    <>
      <PageHeader
        title="Menu builder"
        description="Build a business's food menu, drink list, and happy hour."
        actions={slug && <Button onClick={reload} disabled={loading}>Refresh</Button>}
      />

      <div style={{ marginBottom: 'var(--space-5)', maxWidth: 460 }}>
        <EntityPicker value={slug} onChange={setSlug} label="Business" />
      </div>

      {!slug ? (
        <div className="entity-picker__prompt">Pick a business to build its menus.</div>
      ) : (
        <div className="stack">
          <div className="ui-tabs__bar" role="tablist">
            {LISTS.map((list) => (
              <button
                key={list.id}
                type="button"
                role="tab"
                aria-selected={active === list.id}
                className={`ui-tabs__tab ${active === list.id ? 'is-active' : ''}`}
                onClick={() => setActive(list.id)}
              >
                {list.label}
                <span className="ui-tabs__badge">{counts[list.id]}</span>
              </button>
            ))}
          </div>

          {active === 'menu' && (
            <SectionedItemsEditor
              title="Food menu"
              subtitle="Sections such as Starters, Mains, Desserts — each holding items."
              slug={slug}
              sections={data?.menu_sections || []}
              loading={loading}
              error={error}
              reload={reload}
              sectionCreatePath={endpoints.menu.sections}
              sectionItemPath={endpoints.menu.section}
              itemCreatePath={endpoints.menu.items}
              itemItemPath={endpoints.menu.item}
              itemSchema={menuItemSchema}
              itemNoun="item"
              extraSectionFields={menuSectionExtraFields}
            />
          )}

          {active === 'drinks' && (
            <SectionedItemsEditor
              title="Drinks"
              subtitle="Beer, wine, cocktails, and anything else poured."
              slug={slug}
              sections={data?.drink_sections || []}
              loading={loading}
              error={error}
              reload={reload}
              sectionCreatePath={endpoints.drinks.sections}
              sectionItemPath={endpoints.menu.section}
              itemCreatePath={endpoints.drinks.items}
              itemItemPath={endpoints.drinks.item}
              itemSchema={drinkItemSchema}
              itemNoun="drink"
            />
          )}

          {active === 'happy-hour' && (
            <SectionedItemsEditor
              title="Happy hour"
              subtitle="Discounted items. Set the schedule on the Entity Editor's Hours tab."
              slug={slug}
              sections={data?.happy_hour_sections || []}
              loading={loading}
              error={error}
              reload={reload}
              sectionCreatePath={endpoints.happyHour.sections}
              sectionItemPath={endpoints.menu.section}
              itemCreatePath={endpoints.happyHour.items}
              itemItemPath={endpoints.happyHour.item}
              itemSchema={happyHourItemSchema}
              itemNoun="item"
            />
          )}
        </div>
      )}
    </>
  );
}
