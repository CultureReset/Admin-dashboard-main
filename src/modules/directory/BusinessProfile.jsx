/**
 * Business Profile — a dashboard inside the dashboard.
 *
 * Pick any business and see what that business's own dashboard shows: every
 * table in the database carrying its `entity_slug`, grouped into sections,
 * with its own nav down the side.
 *
 * ── Nothing here knows what a business is ───────────────────────────────
 *
 * There is no list of sections in this file, and there must never be one. The
 * API discovers the tables from the live schema on every request and this
 * screen renders whatever comes back. A restaurant lights up Menu, Hours,
 * Happy Hour. A marina lights up Slips, Bait items, Vessels, Charter trips.
 * Same code — the data decides.
 *
 * Put a row in a new table tomorrow and it becomes a section here with no
 * deploy. That is the contract, and the moment this file gains a
 * `const SECTIONS = [...]` it is broken.
 *
 * ── Two levels of nav ───────────────────────────────────────────────────
 *
 * The app already has a hamburger for the admin sidebar. This adds a second
 * one INSIDE the page for the business's own sections, because on a phone
 * there is no room for both at once. Desktop shows the inner nav as a column;
 * narrow screens collapse it to a button that opens a drawer.
 *
 * GET /api/admin/gcr/profile/:slug
 */

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { useAsync } from '../../hooks/useAsync.js';
import {
  PageHeader, Card, Stat, Badge, Notice, Button,
  LoadingBlock, ErrorState, EmptyState, SearchInput,
} from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import './BusinessProfile.css';

/* ── value rendering ─────────────────────────────────────────────────────── */

/** Columns that identify or bookkeep rather than describe. Shown last. */
const DULL = new Set(['id', 'entity_slug', 'entity_id', 'site_id', 'created_at', 'updated_at', 'sort_order']);

function renderValue(value) {
  if (value === null || value === undefined || value === '') return <span className="bp__null">—</span>;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  if (Array.isArray(value)) {
    if (!value.length) return <span className="bp__null">—</span>;
    return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
  }

  if (typeof value === 'object') {
    return <code className="bp__json">{JSON.stringify(value)}</code>;
  }

  const text = String(value);
  if (/^https?:\/\//i.test(text)) {
    // Images are worth seeing rather than reading.
    if (/\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(text)) {
      return <img className="bp__thumb" src={text} alt="" loading="lazy" />;
    }
    return (
      <a className="bp__link" href={text} target="_blank" rel="noreferrer">
        {text.length > 48 ? `${text.slice(0, 45)}…` : text}
      </a>
    );
  }
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

/** Build table columns from whatever columns the rows actually have. */
function columnsFor(section) {
  const present = new Set();
  for (const row of section.rows) for (const k of Object.keys(row || {})) present.add(k);

  const declared = (section.columns || []).map((c) => c.name).filter((n) => present.has(n));
  for (const k of present) if (!declared.includes(k)) declared.push(k);

  const interesting = declared.filter((c) => !DULL.has(c));
  const dull = declared.filter((c) => DULL.has(c));

  return [...interesting, ...dull].map((name) => ({
    key: name,
    header: name.replace(/_/g, ' '),
    sortable: true,
    searchable: true,
    render: (row) => renderValue(row?.[name]),
    value: (row) => {
      const v = row?.[name];
      return v === null || typeof v === 'object' ? '' : v;
    },
  }));
}

/**
 * A single-row table reads better as a definition list than as a grid — it is
 * the business's details, not a list of things.
 */
function SingleRow({ section }) {
  const row = section.rows[0] || {};
  const keys = Object.keys(row).filter((k) => !DULL.has(k));
  const shown = keys.length ? keys : Object.keys(row);
  return (
    <dl className="bp__facts">
      {shown.map((k) => (
        <div className="bp__fact" key={k}>
          <dt>{k.replace(/_/g, ' ')}</dt>
          <dd>{renderValue(row[k])}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ── the screen ──────────────────────────────────────────────────────────── */

export default function BusinessProfile() {
  const { slug: slugParam } = useParams();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [active, setActive] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);

  /* business picker — only when no slug is chosen */
  const list = useAsync(
    async () => (slugParam ? null : api.get(endpoints.entities.list(), { query: { limit: 2000 } })),
    [slugParam],
    { initialData: null },
  );

  /* the profile itself */
  const profile = useAsync(
    async () => (slugParam ? api.get(endpoints.businessProfile.get(slugParam), {
      query: showEmpty ? { include_empty: 'true' } : undefined,
    }) : null),
    [slugParam, showEmpty],
    { initialData: null },
  );

  const sections = useMemo(
    () => (Array.isArray(profile.data?.sections) ? profile.data.sections : []),
    [profile.data],
  );

  /* group sections by their derived group, preserving order within each */
  const groups = useMemo(() => {
    const out = new Map();
    for (const s of sections) {
      if (!out.has(s.group)) out.set(s.group, []);
      out.get(s.group).push(s);
    }
    return [...out.entries()].sort((a, b) => {
      const an = a[1].reduce((n, s) => n + s.count, 0);
      const bn = b[1].reduce((n, s) => n + s.count, 0);
      return bn - an;
    });
  }, [sections]);

  useEffect(() => {
    if (!active && sections.length) setActive(sections[0].table);
  }, [sections, active]);

  const current = sections.find((s) => s.table === active) || sections[0] || null;

  const pick = useCallback((table) => {
    setActive(table);
    setNavOpen(false);
  }, []);

  /* ── no business chosen yet ─────────────────────────────────────────── */

  if (!slugParam) {
    const businesses = Array.isArray(list.data?.entities) ? list.data.entities : [];
    const filtered = search
      ? businesses.filter((b) =>
          `${b.name || ''} ${b.slug || ''} ${b.city || ''}`.toLowerCase().includes(search.toLowerCase()))
      : businesses;

    return (
      <div>
        <PageHeader
          title="Business profiles"
          description="Open any business and see its own dashboard — every table that holds its data."
        />
        <Notice tone="info" title="This is their dashboard, not a copy of it">
          <p>
            Nothing here is hardcoded. The sections are whatever tables in the database carry this
            business&rsquo;s slug and have rows in them. Add a table with data for a slug and it shows
            up here on the next load — no deploy, no code change.
          </p>
        </Notice>
        <div style={{ height: 'var(--space-4)' }} />
        <Card title={`${filtered.length} businesses`}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, slug or city…" />
          <div style={{ height: 'var(--space-3)' }} />
          {list.loading && <LoadingBlock label="Loading businesses…" />}
          {list.error && <ErrorState error={list.error} onRetry={list.run} context="business list" />}
          {!list.loading && !list.error && (
            <ul className="bp__picker">
              {filtered.slice(0, 400).map((b) => (
                <li key={b.slug}>
                  <button type="button" onClick={() => navigate(`/directory/profile/${b.slug}`)}>
                    <span className="bp__picker-name">{b.name || b.slug}</span>
                    <span className="bp__picker-meta">
                      {b.entity_type || '—'}{b.city ? ` · ${b.city}` : ''}
                    </span>
                    <code className="bp__picker-slug">{b.slug}</code>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  /* ── a business is open ─────────────────────────────────────────────── */

  const entity = profile.data?.entity;

  return (
    <div>
      <PageHeader
        title={entity?.name || slugParam}
        description={
          profile.data
            ? `${profile.data.sections_with_data} sections · ${profile.data.total_rows} rows · ${profile.data.tables_scanned} tables scanned`
            : 'Loading this business…'
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('/directory/profile')}>
              All businesses
            </Button>
            <Button variant="ghost" onClick={() => setShowEmpty((v) => !v)}>
              {showEmpty ? 'Hide empty' : 'Show what is missing'}
            </Button>
            <Button onClick={profile.run}>Refresh</Button>
          </>
        }
      />

      {profile.loading && <LoadingBlock label="Reading every table for this slug…" />}
      {profile.error && <ErrorState error={profile.error} onRetry={profile.run} context="business profile" />}

      {!profile.loading && !profile.error && profile.data && (
        <>
          <div className="bp__stats">
            <Stat label="Sections with data" value={profile.data.sections_with_data} />
            <Stat label="Total rows" value={profile.data.total_rows} />
            <Stat label="Tables scanned" value={profile.data.tables_scanned} hint="from the live schema" />
            <Stat label="Type" value={entity?.entity_type || '—'} hint={entity?.city || ''} />
          </div>

          {!sections.length && (
            <EmptyState
              title="Nothing on file for this business"
              description="No slug-keyed table has a row for it yet."
            />
          )}

          {sections.length > 0 && (
            <div className="bp__layout">
              {/* the inner hamburger — the business's own nav */}
              <button
                type="button"
                className="bp__navtoggle"
                onClick={() => setNavOpen((v) => !v)}
                aria-expanded={navOpen}
              >
                ☰ {current ? current.label : 'Sections'}
                <span className="bp__navtoggle-count">{sections.length}</span>
              </button>

              <nav className={`bp__nav ${navOpen ? 'bp__nav--open' : ''}`}>
                {groups.map(([group, items]) => (
                  <div className="bp__navgroup" key={group}>
                    <p className="bp__navgroup-title">{group}</p>
                    {items.map((s) => (
                      <button
                        type="button"
                        key={s.table}
                        className={`bp__navitem ${s.table === active ? 'bp__navitem--on' : ''} ${s.count === 0 ? 'bp__navitem--empty' : ''}`}
                        onClick={() => pick(s.table)}
                        title={s.table}
                      >
                        <span className="bp__navitem-label">{s.label || s.table}</span>
                        <span className="bp__navitem-count">{s.count}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </nav>

              <div className="bp__panel">
                {current && (
                  <Card
                    title={current.label || current.table}
                    subtitle={<code className="bp__tablename">{current.table}</code>}
                    actions={<Badge tone={current.count ? 'success' : 'neutral'}>{current.count} rows</Badge>}
                  >
                    {current.error && (
                      <Notice tone="warning" title="This table could not be read">
                        <p>{current.error}</p>
                      </Notice>
                    )}
                    {!current.error && current.count === 0 && (
                      <EmptyState
                        title="Not filled in"
                        description={`This business has no rows in ${current.table}.`}
                      />
                    )}
                    {!current.error && current.count > 0 && current.rows.length === 1 && (
                      <SingleRow section={current} />
                    )}
                    {!current.error && current.count > 0 && current.rows.length > 1 && (
                      <DataTable
                        columns={columnsFor(current)}
                        rows={current.rows}
                        pageSize={25}
                        searchable
                        emptyLabel="No rows"
                      />
                    )}
                    {current.count > current.rows.length && (
                      <p className="bp__truncated">
                        Showing the first {current.rows.length} of {current.count} rows.
                      </p>
                    )}
                  </Card>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
