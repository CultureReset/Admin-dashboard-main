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
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { Sparkline, BreakdownBars } from '../engagement/charts.jsx';
import { fields } from '../../lib/fields.jsx';
import '../engagement/charts.css';
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


/* ── editing ─────────────────────────────────────────────────────────────── */

/**
 * Build a form from the table's own columns.
 *
 * The field TYPE comes from the schema the API reported, so a numeric column
 * gets a number input and a boolean gets a switch without anyone writing a
 * form for that table. Identity and bookkeeping columns are omitted — the API
 * refuses to write them anyway, so offering them would be a lie.
 */
const NOT_EDITABLE = new Set(['id', 'entity_slug', 'entity_id', 'site_id', 'created_at', 'updated_at']);

function fieldFor(col) {
  const label = col.name.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const t = String(col.type || 'text').toLowerCase();

  if (t === 'boolean') return fields.bool(col.name, label);
  if (t === 'integer' || t === 'bigint' || t === 'smallint') return fields.number(col.name, label, { step: 1 });
  if (t === 'number' || t === 'numeric' || t === 'double precision' || t === 'real') {
    return fields.money(col.name, label);
  }
  if (t === 'date') return fields.date(col.name, label);
  if (t === 'time' || t === 'time without time zone') return fields.time(col.name, label);
  if (t.startsWith('timestamp') || t === 'date-time') return fields.datetime(col.name, label);
  if (t === 'json' || t === 'jsonb' || t === 'object') return fields.json(col.name, label);
  if (t === 'array') return fields.tags(col.name, label);
  if (/url$/i.test(col.name) || /_url_/i.test(col.name)) return fields.url(col.name, label);
  if (/email/i.test(col.name)) return fields.email(col.name, label);
  if (/phone|tel/i.test(col.name)) return fields.tel(col.name, label);
  if (/description|notes|text|body|summary/i.test(col.name)) return fields.textarea(col.name, label);
  return fields.text(col.name, label);
}

/**
 * Field order, since the schema returns columns in whatever order the table
 * declares them — which put "Zip" above "Name" on a resource. What a person
 * uses to recognise the row goes first, long prose last, everything else in
 * between.
 */
const FIRST = ['name', 'title', 'label', 'slug', 'headline', 'subtitle'];

function fieldRank(col) {
  const i = FIRST.indexOf(col.name);
  if (i !== -1) return i;
  const t = String(col.type || '').toLowerCase();
  if (t === 'json' || t === 'jsonb' || t === 'object' || t === 'array') return 900;
  if (/description|notes|body|summary|text$/i.test(col.name)) return 800;
  return 100;
}

function schemaFor(section) {
  const cols = (section.columns || [])
    .filter((c) => !NOT_EDITABLE.has(c.name))
    .slice()
    .sort((a, b) => fieldRank(a) - fieldRank(b) || a.name.localeCompare(b.name));
  // Fall back to the keys actually present if the schema said nothing, and
  // infer each type from its value — otherwise a boolean renders as the text
  // "true" in a text box, which is both ugly and a way to write the string
  // "true" into a boolean column.
  if (!cols.length && section.rows?.length) {
    const sample = section.rows[0];
    const inferred = Object.keys(sample)
      .filter((k) => !NOT_EDITABLE.has(k))
      .map((name) => {
        const v = sample[name];
        const type = typeof v === 'boolean' ? 'boolean'
          : typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number')
          : Array.isArray(v) ? 'array'
          : v && typeof v === 'object' ? 'object'
          : 'text';
        return { name, type };
      });
    inferred.sort((a, b) => fieldRank(a) - fieldRank(b) || a.name.localeCompare(b.name));
    return inferred.map(fieldFor);
  }
  return cols.map(fieldFor);
}

/** Sentinel for the analytics pane, which is not a table. */
const ANALYTICS_KEY = '__analytics__';


/**
 * What visitors did to this one business.
 *
 * A rate is shown only when its denominator is real; the API returns null
 * otherwise, and null renders as "not enough recorded" rather than 0%. That
 * distinction matters — a business with two views and one click is not a 50%
 * performer, it is barely measured.
 */
function AnalyticsPane({ query, name }) {
  const d = query.data;
  const t = d?.totals || {};
  const r = d?.rates || {};

  const pct = (v) => (v === null || v === undefined ? <span className="bp__null">not enough data</span> : `${v}%`);

  return (
    <Card
      title="Analytics"
      subtitle={d ? `last ${d.window_days} days · since ${d.since}` : 'visitor behaviour'}
      actions={<Button variant="ghost" onClick={query.run}>Refresh</Button>}
    >
      {query.loading && <LoadingBlock label="Reading recorded behaviour…" />}
      {query.error && <ErrorState error={query.error} onRetry={query.run} context="business analytics" />}

      {!query.loading && !query.error && d && (
        <>
          <div className="an__stats">
            <Stat label="Profile views" value={t.page_views ?? 0} />
            <Stat label="Outbound clicks" value={t.clicks ?? 0} hint={`${t.clicks_converted ?? 0} converted`} />
            <Stat label="Saves" value={t.saves ?? 0} hint={`${t.super_likes ?? 0} super likes`} />
            <Stat label="Swipes" value={t.swipes ?? 0} hint={`${t.swipes_right ?? 0} right`} />
            <Stat label="Times shown" value={t.times_shown ?? 0} hint="Trip Swipe" />
          </div>

          <div className="an__grid">
            <Card title="Click rate" padded>
              <p className="bp__bigrate">{pct(r.click_through)}</p>
              <p className="an__note">Clicks per profile view.</p>
            </Card>
            <Card title="Swipe right rate" padded>
              <p className="bp__bigrate">{pct(r.swipe_right)}</p>
              <p className="an__note">Of everyone who swiped on {name}.</p>
            </Card>
            <Card title="Save after seen" padded>
              <p className="bp__bigrate">{pct(r.save_after_seen)}</p>
              <p className="an__note">Kept it after being shown it.</p>
            </Card>
          </div>

          <div style={{ height: 'var(--space-4)' }} />

          {d.views_by_day?.length ? (
            <Card title="Views per day">
              <Sparkline points={d.views_by_day.map((p) => ({ label: p.date, value: p.views }))} />
            </Card>
          ) : (
            <EmptyState title="No views recorded in this window" />
          )}

          {d.clicks_by_type?.length > 0 && (
            <>
              <div style={{ height: 'var(--space-3)' }} />
              <Card title="What they clicked">
                <BreakdownBars items={d.clicks_by_type} />
              </Card>
            </>
          )}

          <div style={{ height: 'var(--space-3)' }} />
          <Notice tone="warning" title="What these numbers are — and are not">
            <p>{d.coverage?.page_views}</p>
            <p style={{ marginTop: 8 }}>{d.coverage?.not_tracked}</p>
          </Notice>
        </>
      )}
    </Card>
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
  const [editing, setEditing] = useState(null);   // { section, row } | { section, row: null } for new
  const toast = useToast();

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

  /* what visitors did to this business — a section like any other */
  const stats = useAsync(
    async () => (slugParam ? api.get(endpoints.analytics.entity(slugParam), { query: { days: 30 } }) : null),
    [slugParam],
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
    if (!active && sections.length) setActive(ANALYTICS_KEY);
  }, [sections, active]);

  const showingAnalytics = active === ANALYTICS_KEY;
  const current = showingAnalytics ? null : (sections.find((s) => s.table === active) || sections[0] || null);

  const pick = useCallback((table) => {
    setActive(table);
    setNavOpen(false);
  }, []);

  const saveRow = useCallback(async (values) => {
    const { section, row } = editing;
    const isNew = !row?.id;
    const res = isNew
      ? await api.post(endpoints.businessProfile.createRow(slugParam, section.table), values)
      : await api.patch(endpoints.businessProfile.row(slugParam, section.table, row.id), values);

    // The API reports fields it refused rather than silently dropping them.
    if (res?.ignored?.length) {
      toast.info(`Saved. Ignored: ${res.ignored.join(', ')}`);
    } else {
      toast.success(isNew ? 'Row added' : 'Saved');
    }
    setEditing(null);
    profile.run();
  }, [editing, slugParam, profile, toast]);

  const deleteRow = useCallback(async (section, row) => {
    if (!row?.id) return;
    await api.del(endpoints.businessProfile.row(slugParam, section.table, row.id));
    toast.success('Deleted');
    profile.run();
  }, [slugParam, profile, toast]);

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
            ? `${profile.data.sections_with_data} sections · ${profile.data.total_rows} rows · searched ${profile.data.tables_scanned} database tables`
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
            <Stat label="Database tables searched" value={profile.data.tables_scanned} hint="every table keyed by slug" />
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
                ☰ {showingAnalytics ? 'Analytics' : current ? current.label : 'Sections'}
                <span className="bp__navtoggle-count">{sections.length}</span>
              </button>

              <nav className={`bp__nav ${navOpen ? 'bp__nav--open' : ''}`}>
                <div className="bp__navgroup">
                  <p className="bp__navgroup-title">Performance</p>
                  <button
                    type="button"
                    className={`bp__navitem ${showingAnalytics ? 'bp__navitem--on' : ''}`}
                    onClick={() => pick(ANALYTICS_KEY)}
                  >
                    <span className="bp__navitem-label">Analytics</span>
                    <span className="bp__navitem-count">{stats.data?.totals?.page_views ?? '—'}</span>
                  </button>
                </div>
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
                {showingAnalytics && (
                  <AnalyticsPane query={stats} name={profile.data?.entity?.name || slugParam} />
                )}
                {!showingAnalytics && current && (
                  <Card
                    title={current.label || current.table}
                    subtitle={<code className="bp__tablename">{current.table}</code>}
                    actions={
                      <>
                        <Badge tone={current.count ? 'success' : 'neutral'}>{current.count} rows</Badge>
                        <Button onClick={() => setEditing({ section: current, row: null })}>Add</Button>
                      </>
                    }
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
                      <>
                        <SingleRow section={current} />
                        <div className="bp__rowactions">
                          <Button variant="ghost" onClick={() => setEditing({ section: current, row: current.rows[0] })}>
                            Edit
                          </Button>
                        </div>
                      </>
                    )}
                    {!current.error && current.count > 0 && current.rows.length > 1 && (
                      <DataTable
                        columns={[
                          ...columnsFor(current),
                          {
                            key: '__edit',
                            header: '',
                            width: '108px',
                            align: 'right',
                            render: (row) => (
                              <span className="bp__rowactions">
                                <Button variant="ghost" onClick={() => setEditing({ section: current, row })}>
                                  Edit
                                </Button>
                              </span>
                            ),
                          },
                        ]}
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

          {editing && (
            <Modal
              open
              title={`${editing.row ? 'Edit' : 'New'} ${editing.section.label || editing.section.table}`}
              subtitle={editing.section.table}
              onClose={() => setEditing(null)}
              size="lg"
            >
              <SchemaForm
                schema={schemaFor(editing.section)}
                initialValues={editing.row || {}}
                onSubmit={saveRow}
                onCancel={() => setEditing(null)}
                submitLabel={editing.row ? 'Save changes' : 'Add row'}
                extraActions={
                  editing.row?.id ? (
                    <Button
                      variant="danger"
                      onClick={async () => {
                        await deleteRow(editing.section, editing.row);
                        setEditing(null);
                      }}
                    >
                      Delete
                    </Button>
                  ) : null
                }
              />
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
