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
import '../../ui/chips.css';
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

/** Columns of this table, from the schema or inferred from a row. */
function columnsOf(section) {
  const declared = (section.columns || []).filter((c) => !NOT_EDITABLE.has(c.name));
  if (declared.length) return declared;

  // The API reported no types. Infer from a row, otherwise a boolean renders
  // as the string "true" in a text box — and saving would write "true" into a
  // boolean column.
  const sample = section.rows?.[0];
  if (!sample) return [];
  return Object.keys(sample)
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
}

const isBlank = (v) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * Split a table's columns into the ones this business actually uses and the
 * ones it has never filled in.
 *
 * ── Why presence and not industry ───────────────────────────────────────
 *
 * `bookable_resources` carries bedrooms, bathrooms, sqft, wifi_ssid and
 * nightly_rate because a condo needs them. A fishing charter's boat does not,
 * and asking a charter operator for a bedroom count is noise.
 *
 * The tempting fix is to decide by entity_type — show bedrooms for condos,
 * hide them for charters. That is wrong, and it is the same mistake as naming
 * a table after an industry: a 65ft sportfish genuinely has a head and two
 * berths, and a rule keyed on "charter" would refuse to let anyone record
 * them.
 *
 * So nothing here looks at the industry. A field is shown because THIS row
 * uses it, or because another row in the same table for the same business
 * uses it — a marina with six boats where one has a head shows the head field
 * on all six, which is right, because the question is now live for that
 * business. Everything else moves behind "Add a field", one click away and
 * never lost.
 */
function splitFields(section, row) {
  const cols = columnsOf(section);
  const rows = section.rows || [];

  const usedByBusiness = new Set();
  for (const r of rows) {
    for (const [k, v] of Object.entries(r || {})) {
      if (!isBlank(v)) usedByBusiness.add(k);
    }
  }
  // A new row has nothing of its own yet, so it inherits what the business
  // already uses in this table — a seventh boat gets the same fields as the
  // other six rather than a blank slate.
  for (const [k, v] of Object.entries(row || {})) {
    if (!isBlank(v)) usedByBusiness.add(k);
  }

  const byRank = (a, b) => fieldRank(a) - fieldRank(b) || a.name.localeCompare(b.name);
  const inUse = cols.filter((c) => usedByBusiness.has(c.name)).sort(byRank);
  const unused = cols.filter((c) => !usedByBusiness.has(c.name)).sort(byRank);

  // A brand-new table with no rows anywhere would otherwise open empty, so
  // fall back to showing everything rather than nothing.
  if (!inUse.length) return { inUse: unused, unused: [] };
  return { inUse, unused };
}


/**
 * The row editor.
 *
 * Opens on the fields this business actually uses. Everything else the table
 * supports sits behind "Add a field" — so a charter's boat is not asked for a
 * bedroom count, but the operator of a 65ft sportfish can add "Head: 1"
 * without anyone changing the schema or the code.
 */
function RowEditor({ section, row, onSave, onCancel, onDelete }) {
  const { inUse, unused } = useMemo(() => splitFields(section, row), [section, row]);
  const [added, setAdded] = useState([]);
  const [picking, setPicking] = useState(false);
  const [filter, setFilter] = useState('');

  const shown = useMemo(
    () => [...inUse, ...unused.filter((c) => added.includes(c.name))]
      .sort((a, b) => fieldRank(a) - fieldRank(b) || a.name.localeCompare(b.name)),
    [inUse, unused, added],
  );

  const offer = useMemo(
    () => unused
      .filter((c) => !added.includes(c.name))
      .filter((c) => !filter || c.name.replace(/_/g, ' ').includes(filter.toLowerCase())),
    [unused, added, filter],
  );

  return (
    <>
      <SchemaForm
        schema={shown.map(fieldFor)}
        initialValues={row || {}}
        onSubmit={onSave}
        onCancel={onCancel}
        submitLabel={row?.id ? 'Save changes' : 'Add row'}
        extraActions={
          row?.id ? <Button variant="danger" onClick={onDelete}>Delete</Button> : null
        }
      />

      {unused.length > 0 && (
        <div className="bp__addfield">
          {!picking ? (
            <Button variant="ghost" onClick={() => setPicking(true)}>
              + Add a field ({unused.length - added.length} not used yet)
            </Button>
          ) : (
            <>
              <p className="an__note">
                Fields this table supports that {section.label || section.table} has not used.
                Nothing is hidden by industry — only by whether it has ever been filled in.
              </p>
              <SearchInput value={filter} onChange={setFilter} placeholder="Find a field…" />
              <div className="bp__chips">
                {offer.map((c) => (
                  <button
                    type="button"
                    key={c.name}
                    className="bp__chip"
                    onClick={() => { setAdded((a) => [...a, c.name]); setFilter(''); }}
                  >
                    + {c.name.replace(/_/g, ' ')}
                  </button>
                ))}
                {!offer.length && <span className="an__note">Nothing left to add.</span>}
              </div>
              <Button variant="ghost" onClick={() => setPicking(false)}>Done</Button>
            </>
          )}
        </div>
      )}
    </>
  );
}


/**
 * Fill a section from the business's own links.
 *
 * Paste a website, a Google Business page, an Airbnb listing, a Facebook page.
 * The API fetches them, reads the text, and proposes values for THIS table's
 * real columns — not a fixed set of fields, and not a prose blob.
 *
 * Nothing is saved here. Each proposal opens in the ordinary row editor so a
 * person sees every field before it lands. Extraction from a web page is a
 * guess, and a guess should not reach the database unreviewed.
 */
function IngestPanel({ section, slug, onUse }) {
  const [open, setOpen] = useState(false);
  const [urls, setUrls] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    setBusy(true); setError(null); setResult(null);
    try {
      const list = urls.split(/[\n,]/).map((u) => u.trim()).filter(Boolean);
      setResult(await api.post(endpoints.businessProfile.ingest(slug, section.table), {
        urls: list, notes: notes.trim() || undefined,
      }));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="bp__ingest">
        <Button variant="ghost" onClick={() => setOpen(true)}>
          ✨ Fill from a website or listing
        </Button>
      </div>
    );
  }

  return (
    <div className="bp__ingest bp__ingest--open">
      <p className="an__note">
        Paste any links about this business — its website, Google Business page, Airbnb or booking
        listing, a Facebook or Instagram page. They are read and turned into values for{' '}
        <code>{section.table}</code>. Nothing is saved until you review it.
      </p>

      <textarea
        className="bp__urls"
        rows={3}
        value={urls}
        onChange={(e) => setUrls(e.target.value)}
        placeholder={'https://example.com/rates\nhttps://www.google.com/maps/place/…'}
      />
      <textarea
        className="bp__urls"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Or paste text directly — an email, a rate sheet, a brochure."
      />

      <div className="bp__rowactions">
        <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
        <Button onClick={run} disabled={busy || (!urls.trim() && !notes.trim())}>
          {busy ? 'Reading…' : 'Read and propose'}
        </Button>
      </div>

      {busy && <LoadingBlock label="Fetching the pages and extracting…" />}
      {error && <ErrorState error={error} onRetry={run} context="ingest" />}

      {result && (
        <div className="bp__proposals">
          <ul className="bp__sources">
            {result.sources?.map((src) => (
              <li key={src.url}>
                <Badge tone={src.ok ? 'success' : 'warning'}>{src.ok ? `${src.chars} chars` : src.error}</Badge>
                <span className="bp__srcurl">{src.url}</span>
              </li>
            ))}
          </ul>

          {result.model_notes && (
            <Notice tone="info" title="What it could not place">
              <p>{result.model_notes}</p>
            </Notice>
          )}

          {!result.proposed?.length && (
            <EmptyState title="Nothing extractable found" description="The pages were read but held nothing that maps to this table." />
          )}

          {result.proposed?.map((p, i) => (
            <Card
              key={i}
              title={`Proposed row ${i + 1}`}
              actions={<Button onClick={() => onUse(p.values)}>Review & add</Button>}
            >
              <dl className="bp__facts">
                {Object.entries(p.values).map(([k, v]) => (
                  <div className="bp__fact" key={k}>
                    <dt>{k.replace(/_/g, ' ')}</dt>
                    <dd>{renderValue(v)}</dd>
                  </div>
                ))}
              </dl>
              {p.dropped?.length > 0 && (
                <p className="an__note">Ignored, not columns of this table: {p.dropped.join(', ')}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
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
      actions={<Button variant="ghost" onClick={() => query.reload()}>Refresh</Button>}
    >
      {query.loading && <LoadingBlock label="Reading recorded behaviour…" />}
      {query.error && <ErrorState error={query.error} onRetry={query.reload} context="business analytics" />}

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
  const [addingSection, setAddingSection] = useState(false);
  const [sectionFilter, setSectionFilter] = useState('');
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

  /* Every slug-keyed table, including the ones with no rows — the catalogue
     behind "Add section". Kept separate from the main read so switching it on
     does not reshuffle what is on screen. */
  const catalogue = useAsync(
    async () => (slugParam
      ? api.get(endpoints.businessProfile.get(slugParam), { query: { include_empty: 'true' } })
      : null),
    [slugParam],
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

  /**
   * What the business declares it has, in its own order — straight from
   * `entity_modules`, the same table routes/gcr.js reads to decide what the
   * public site renders. Not a second opinion, the same source of truth.
   */
  const modules = useMemo(
    () => (Array.isArray(profile.data?.modules) ? profile.data.modules : []),
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

  /** Tables that exist but this business has never put a row in. */
  const unusedSections = useMemo(() => {
    const all = Array.isArray(catalogue.data?.sections) ? catalogue.data.sections : [];
    return all.filter((s) => !s.count).sort((a, b) => a.table.localeCompare(b.table));
  }, [catalogue.data]);

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
          {list.error && <ErrorState error={list.error} onRetry={list.reload} context="business list" />}
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
            <Button onClick={() => profile.reload()}>Refresh</Button>
          </>
        }
      />

      {profile.loading && <LoadingBlock label="Reading every table for this slug…" />}
      {profile.error && <ErrorState error={profile.error} onRetry={profile.reload} context="business profile" />}

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
                {modules.length > 0 && (
                  <div className="bp__navgroup">
                    <p className="bp__navgroup-title">Its own sections</p>
                    <div className="bp__modules">
                      {modules.map((m) => (
                        <span
                          key={m.key}
                          className={`bp__module ${m.enabled ? '' : 'bp__module--off'}`}
                          title={m.enabled ? 'Enabled' : 'Turned off'}
                        >
                          {m.key}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {unusedSections.length > 0 && (
                  <div className="bp__navgroup">
                    <p className="bp__navgroup-title">Not used yet</p>
                    <button
                      type="button"
                      className="bp__navitem bp__navitem--add"
                      onClick={() => setAddingSection(true)}
                    >
                      <span className="bp__navitem-label">+ Add a section</span>
                      <span className="bp__navitem-count">{unusedSections.length}</span>
                    </button>
                  </div>
                )}
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

                    <IngestPanel
                      section={current}
                      slug={slugParam}
                      onUse={(values) => setEditing({ section: current, row: values })}
                    />
                  </Card>
                )}
              </div>
            </div>
          )}

          {addingSection && (
            <Modal
              open
              title="Add a section"
              subtitle={`${unusedSections.length} tables this business has not used`}
              onClose={() => setAddingSection(false)}
              size="lg"
            >
              <Notice tone="info" title="Every table, not a shortlist">
                <p>
                  These are all the slug-keyed tables in the database that {profile.data?.entity?.name || slugParam}
                  {' '}has no rows in. Nothing is filtered by what kind of business this is — a charter can start a
                  Units section if one of its boats has berths, and a condo can start Vessels if it runs a shuttle.
                  Adding the first row makes it a live section.
                </p>
              </Notice>
              <div style={{ height: 'var(--space-3)' }} />
              <SearchInput
                value={sectionFilter}
                onChange={setSectionFilter}
                placeholder="Find a section…"
              />
              <div className="bp__chips bp__chips--tall">
                {unusedSections
                  .filter((s) => !sectionFilter
                    || `${s.label} ${s.table} ${s.group}`.toLowerCase().includes(sectionFilter.toLowerCase()))
                  .map((s) => (
                    <button
                      type="button"
                      key={s.table}
                      className="bp__chip"
                      onClick={() => {
                        setAddingSection(false);
                        setSectionFilter('');
                        setEditing({ section: s, row: null });
                      }}
                      title={s.table}
                    >
                      + {s.group} · {s.label || s.table}
                    </button>
                  ))}
              </div>
            </Modal>
          )}

          {editing && (
            <Modal
              open
              title={`${editing.row ? 'Edit' : 'New'} ${editing.section.label || editing.section.table}`}
              subtitle={editing.section.table}
              onClose={() => setEditing(null)}
              size="lg"
            >
              <RowEditor
                section={editing.section}
                row={editing.row}
                onSave={saveRow}
                onCancel={() => setEditing(null)}
                onDelete={async () => {
                  await deleteRow(editing.section, editing.row);
                  setEditing(null);
                }}
              />
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
