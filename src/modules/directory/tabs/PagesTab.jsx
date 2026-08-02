/**
 * Entity Editor → Pages.
 *
 * Which public pages this business appears on. `entity_type` sets the primary
 * page; `also_appears_on` (a text[] column) adds extras. Both are plain entity
 * columns, so this writes through the normal entity PATCH.
 *
 * The legacy dashboard used /api/admin/gcr/entity-pages and
 * /api/admin/gcr/page-assignments for this; neither route exists in
 * gcr-api-clean, and the entity columns hold the same information, so this
 * screen uses them directly instead of calling a route that 404s.
 */

import { useEffect, useState } from 'react';
import { Button, Card, Notice } from '../../../ui/primitives.jsx';
import { ENTITY_TYPES, GCR_PAGES } from '../entitySchema.js';
import './PagesTab.css';

/** Which page an entity_type lands on by default. */
const TYPE_TO_PAGE = {
  restaurant: 'restaurants',
  coffee: 'coffee-sweets',
  dessert: 'coffee-sweets',
  bakery: 'coffee-sweets',
  activity: 'things-to-do',
  service: 'services',
  shopping: 'shopping',
  hotel: 'staying',
  condo: 'staying',
  'vacation-rental': 'staying',
  park: 'public-spots',
};

export default function PagesTab({ entity, patch, saving }) {
  const [entityType, setEntityType] = useState(entity?.entity_type || '');
  const [alsoOn, setAlsoOn] = useState([]);

  useEffect(() => {
    setEntityType(entity?.entity_type || '');
    setAlsoOn(Array.isArray(entity?.also_appears_on) ? entity.also_appears_on : []);
  }, [entity]);

  const primaryPage = TYPE_TO_PAGE[entityType] || null;

  const toggle = (page) => {
    // The primary page is implied by entity_type, so it is never an extra.
    if (page === primaryPage) return;
    setAlsoOn((prev) => (prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page]));
  };

  const dirty =
    entityType !== (entity?.entity_type || '') ||
    JSON.stringify([...alsoOn].sort()) !==
      JSON.stringify([...(entity?.also_appears_on || [])].sort());

  const save = () =>
    patch({
      entity: {
        entity_type: entityType || null,
        // Drop the primary page if it slipped into the extras list.
        also_appears_on: alsoOn.filter((page) => page !== primaryPage),
      },
    });

  return (
    <Card
      title="Page placement"
      subtitle="Where this business shows up on the public GCR site."
      actions={
        <Button variant="primary" size="sm" disabled={!dirty} loading={saving} onClick={save}>
          Save placement
        </Button>
      }
    >
      <div className="stack">
        <div className="pages-primary">
          <label className="ui-field__label" htmlFor="entity-type">Primary type</label>
          <select
            id="entity-type"
            className="ui-input ui-input--select"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          >
            <option value="">— not set —</option>
            {ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <p className="ui-field__help">
            Constrained by a CHECK on the entity table — only these values are accepted.
            {primaryPage && ` Lands on the “${primaryPage}” page.`}
          </p>
        </div>

        <div>
          <div className="ui-field__label" style={{ marginBottom: 'var(--space-2)' }}>
            Also appears on
          </div>
          <div className="pages-grid">
            {GCR_PAGES.map((page) => {
              const isPrimary = page.value === primaryPage;
              const isOn = isPrimary || alsoOn.includes(page.value);
              return (
                <button
                  type="button"
                  key={page.value}
                  className={`pages-chip ${isOn ? 'is-on' : ''} ${isPrimary ? 'is-primary' : ''}`}
                  onClick={() => toggle(page.value)}
                  disabled={isPrimary}
                  title={isPrimary ? 'Primary page — set by the entity type above' : undefined}
                >
                  <span className="pages-chip__label">{page.label}</span>
                  <span className="pages-chip__slug mono">{page.value}</span>
                  {isPrimary && <span className="pages-chip__tag">primary</span>}
                </button>
              );
            })}
          </div>
        </div>

        {!entityType && (
          <Notice tone="warning" title="No primary type">
            Without an <code>entity_type</code> this business will not appear on any category page.
          </Notice>
        )}
      </div>
    </Card>
  );
}
