/**
 * Entity picker.
 *
 * Many sections operate on "whichever entity the admin chose". This component
 * is the single way that choice is made — nothing in the app names a business
 * or a slug in source. The chosen entity is remembered across sections and
 * across reloads, so moving between the Menu Builder and the Entity Editor
 * keeps you on the same business.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, unwrapList } from '../api/client.js';
import { endpoints } from '../api/endpoints.js';
import { usePersistentState, useDebounced } from '../hooks/useAsync.js';
import { Spinner } from '../ui/primitives.jsx';
import './EntityPicker.css';

const EntityContext = createContext(null);

/**
 * Loads the entity list once and shares it. The list route returns every
 * entity in one payload, so a single fetch serves every picker in the app.
 */
export function EntityProvider({ children }) {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSlug, setSelectedSlug] = usePersistentState('cc_admin_entity', null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.get(endpoints.entities.list());
      const rows = unwrapList(payload, ['entities']);
      setEntities(rows);
      return rows;
    } catch (err) {
      setError(err);
      setEntities([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(
    () => entities.find((e) => e.slug === selectedSlug) || null,
    [entities, selectedSlug],
  );

  const value = useMemo(
    () => ({ entities, loading, error, reload: load, selectedSlug, selected, setSelectedSlug }),
    [entities, loading, error, load, selectedSlug, selected, setSelectedSlug],
  );

  return <EntityContext.Provider value={value}>{children}</EntityContext.Provider>;
}

export function useEntities() {
  const ctx = useContext(EntityContext);
  if (!ctx) throw new Error('useEntities must be used inside <EntityProvider>');
  return ctx;
}

/**
 * Searchable combobox over the entity list.
 *
 * @param {string} value       Selected slug.
 * @param {function} onChange  (slug, entity) => void
 */
export function EntityPicker({
  value,
  onChange,
  label = 'Business',
  placeholder = 'Search businesses…',
  allowClear = true,
  autoFocus = false,
}) {
  const { entities, loading, error } = useEntities();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(query, 150);

  const selected = useMemo(() => entities.find((e) => e.slug === value) || null, [entities, value]);

  const matches = useMemo(() => {
    const needle = debounced.trim().toLowerCase();
    const source = entities;
    if (!needle) return source.slice(0, 50);
    return source
      .filter(
        (e) =>
          (e.name || '').toLowerCase().includes(needle) ||
          (e.slug || '').toLowerCase().includes(needle) ||
          (e.city || '').toLowerCase().includes(needle),
      )
      .slice(0, 50);
  }, [entities, debounced]);

  const choose = (entity) => {
    onChange?.(entity ? entity.slug : null, entity || null);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="entity-picker">
      {label && <label className="entity-picker__label">{label}</label>}

      <div className="entity-picker__control">
        {selected && !open ? (
          <button type="button" className="entity-picker__selected" onClick={() => setOpen(true)}>
            {selected.hero_image_url && (
              <img src={selected.hero_image_url} alt="" className="entity-picker__thumb" />
            )}
            <span className="entity-picker__selname truncate">{selected.name}</span>
            <span className="entity-picker__selslug mono truncate">{selected.slug}</span>
            <span className="entity-picker__caret" aria-hidden="true">▾</span>
          </button>
        ) : (
          <input
            className="entity-picker__input"
            type="search"
            value={query}
            autoFocus={autoFocus || open}
            placeholder={loading ? 'Loading businesses…' : placeholder}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onBlur={() => setTimeout(() => setOpen(false), 160)}
            disabled={loading && entities.length === 0}
          />
        )}

        {allowClear && selected && (
          <button
            type="button"
            className="entity-picker__clear"
            onClick={() => choose(null)}
            aria-label="Clear selection"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div className="entity-picker__menu">
          {loading && entities.length === 0 && (
            <div className="entity-picker__status">
              <Spinner size={14} label="Loading…" />
            </div>
          )}
          {error && <div className="entity-picker__status entity-picker__status--error">{error.message}</div>}
          {!loading && matches.length === 0 && (
            <div className="entity-picker__status">No businesses match “{debounced}”.</div>
          )}
          {matches.map((entity) => (
            <button
              key={entity.slug}
              type="button"
              className={`entity-picker__option ${entity.slug === value ? 'is-selected' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(entity)}
            >
              <span className="entity-picker__optname truncate">{entity.name}</span>
              <span className="entity-picker__optmeta mono truncate">
                {[entity.entity_subtype, entity.city].filter(Boolean).join(' · ') || entity.slug}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Wrapper for sections that need an entity before they can show anything.
 * Renders the picker, then `children(slug, entity)` once one is chosen.
 */
export function RequireEntity({ value, onChange, children, hint }) {
  const { selected } = useEntities();
  const active = value != null ? value : null;

  return (
    <div className="stack">
      <div className="entity-picker__bar">
        <EntityPicker value={active} onChange={onChange} />
        {hint && <p className="muted entity-picker__hint">{hint}</p>}
      </div>
      {active ? children(active, selected) : (
        <div className="entity-picker__prompt">
          Pick a business above to continue.
        </div>
      )}
    </div>
  );
}

export default EntityPicker;
