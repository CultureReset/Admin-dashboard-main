/**
 * Structured listing data for one business — the capability tables.
 *
 * A capability is a THING a business can have: units, boats, trips, gear,
 * packages, spaces, plus one row of operating details. Not an industry.
 *
 *   ANY business can use ANY capability.
 *
 * That is the whole point and it is why this screen offers all of them to
 * everyone. A marina that runs charters, rents pontoons, lends bikes and has a
 * dockside deck fills in boats, trips, gear and spaces — the same four tables
 * a hotel would use for its own boat, its own sunset cruise, its own bikes and
 * its own ballroom. Nothing is hidden because of what the directory calls the
 * business; the suggested set only decides what is open on arrival.
 *
 * Every form is built from the column map the API serves, and a build-time
 * check in gcr-api-clean fails if that map ever names a column the SQL does
 * not create. No jsonb, no key/value rows, no comma-separated lists.
 *
 * GET  /api/admin/platform/listing/:slug
 * GET  /api/admin/platform/capabilities?slug=
 * GET  /api/admin/platform/catalog/:name
 * PUT  /api/admin/platform/listing/:slug/operations
 * POST /api/admin/platform/listing/:slug/:capability
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, Notice, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { fields as f } from '../../lib/fields.jsx';

const prettify = (v) => String(v).replace(/_/g, ' ');

/** Column descriptor → SchemaForm field. */
function toFormField(column) {
  const help = [
    column.unit && column.unit !== '$' ? `In ${column.unit}.` : null,
    column.search === 'min' ? 'Filterable: at least this.'
      : column.search === 'max' ? 'Filterable: at most this.'
        : column.search === 'has' ? 'Filterable.'
          : column.search === 'eq' ? 'Filterable: exact match.'
            : null,
  ].filter(Boolean).join(' ') || undefined;
  const extra = { help, required: column.required || undefined };

  switch (column.type) {
    case 'int': return f.number(column.name, column.label, { min: 0, step: 1, ...extra });
    case 'decimal': return f.number(column.name, column.label, { min: 0, step: column.step || 0.01, ...extra });
    case 'bool': return f.bool(column.name, column.label, extra);
    case 'time': return f.time(column.name, column.label, extra);
    default:
      if (column.long) return f.textarea(column.name, column.label, extra);
      // `suggestions` are a hint, not a constraint — the API stores whatever
      // is typed, so a business can call its boat something nobody listed.
      if (column.suggestions) {
        return f.select(
          column.name,
          column.label,
          [{ value: '', label: '—' }, ...column.suggestions.map((o) => ({ value: o, label: prettify(o) }))],
          extra,
        );
      }
      return f.text(column.name, column.label, extra);
  }
}

function toSchema(columns) {
  const groups = [];
  for (const column of columns) {
    const title = column.group || 'Details';
    let group = groups.find((g) => g.title === title);
    if (!group) { group = { title, fields: [] }; groups.push(group); }
    group.fields.push(toFormField(column));
  }
  return { groups };
}

function toValues(columns, record) {
  const out = {};
  for (const column of columns) {
    const v = record ? record[column.name] : undefined;
    if (v === undefined || v === null) out[column.name] = column.type === 'bool' ? false : '';
    else if (column.type === 'time' && typeof v === 'string') out[column.name] = v.slice(0, 5);
    else out[column.name] = v;
  }
  return out;
}

/** Strip empties so a blank field clears the column rather than storing ''. */
function toRecord(columns, values) {
  const out = {};
  for (const column of columns) {
    const v = values[column.name];
    out[column.name] = v === '' || v === undefined ? null : v;
  }
  return out;
}

export default function AttributesPanel({ slug }) {
  const toast = useToast();
  const [open, setOpen] = useState(null);   // which capability is expanded

  const listing = useAsync(
    async () => (slug ? api.get(endpoints.bookingPlatform.listing(slug)) : null),
    [slug],
    { initialData: null },
  );

  const meta = useAsync(
    async () => (slug ? api.get(endpoints.bookingPlatform.capabilities(slug)) : null),
    [slug],
    { initialData: null },
  );

  const amenities = useAsync(
    async () => api.get(endpoints.bookingPlatform.catalog('amenities')),
    [],
    { initialData: null },
  );

  // Open whatever the business already uses; fall back to the suggestion.
  useEffect(() => {
    if (open || !listing.data) return;
    const used = listing.data.in_use || [];
    setOpen(used[0] || (listing.data.suggested || [])[0] || 'operations');
  }, [listing.data, open]);

  const capabilities = useMemo(
    () => (Array.isArray(meta.data?.capabilities) ? meta.data.capabilities : []),
    [meta.data],
  );

  if (!slug) {
    return <EmptyState icon="📐" title="No business selected" description="Pick a business to edit its listing data." />;
  }
  if ((listing.loading && !listing.data) || (meta.loading && !meta.data)) return <LoadingBlock />;
  if (listing.error) return <ErrorState error={listing.error} onRetry={listing.reload} />;
  if (meta.error) return <ErrorState error={meta.error} onRetry={meta.reload} />;
  if (!listing.data || !meta.data) return null;

  const data = listing.data;
  const inUse = new Set(data.in_use || []);
  const suggested = new Set(data.suggested || []);
  const reload = () => listing.reload();

  return (
    <>
      <Notice tone="info" title="Any business can use any of these">
        <p>
          These are things a business <em>has</em> — units, boats, trips, gear, packages, spaces —
          not industries. A marina that runs charters, rents pontoons, lends bikes and has a
          dockside deck fills in four of them. Nothing is hidden because of what the directory
          calls it.
        </p>
        <p style={{ marginTop: 8 }}>
          Every field is a real typed column. Try them in{' '}
          <Link to="/booking/match">Find a Match</Link>.
        </p>
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="In use" value={inUse.size} tone={inUse.size ? 'success' : 'warning'} hint={[...inUse].join(', ') || 'nothing yet'} />
        <Stat label="Available" value={capabilities.length} hint="every one, to every business" />
        <Stat label="Type" value={data.entity_subtype || data.entity_type || '—'} />
        {data.children?.length > 0 && <Stat label="Child listings" value={data.children.length} tone="primary" />}
      </div>

      <Card title="What this business has" subtitle="Click one to fill it in. Nothing is restricted.">
        <div className="row-wrap" style={{ gap: 6 }}>
          {capabilities.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`ui-multi__chip ${open === c.key ? 'is-active' : ''}`}
              onClick={() => setOpen(c.key)}
              title={c.hint}
            >
              {c.label}
              {inUse.has(c.key) && ' ✓'}
              {!inUse.has(c.key) && suggested.has(c.key) && ' ·'}
            </button>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 'var(--space-3)', fontSize: 12 }}>
          ✓ already filled in · &nbsp;·&nbsp; suggested for this kind of business
        </p>
      </Card>

      <div style={{ height: 'var(--space-4)' }} />

      {capabilities
        .filter((c) => c.key === open)
        .map((c) => (
          <CapabilityEditor
            key={c.key}
            slug={slug}
            capability={c}
            state={data.capabilities[c.key]}
            amenityCatalog={amenities.data}
            onChanged={reload}
          />
        ))}

      <div style={{ height: 'var(--space-5)' }} />

      <EntityLists
        slug={slug}
        lists={meta.data.entity_lists || []}
        values={data.lists || {}}
        onChanged={reload}
      />

      {data.children?.length > 0 && (
        <>
          <div style={{ height: 'var(--space-5)' }} />
          <Card padded={false} title="Child listings" subtitle="Each is its own entity with its own capabilities.">
            <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
              <DataTable
                columns={[
                  {
                    key: 'name',
                    header: 'Listing',
                    render: (r) => (
                      <Link to={`/directory/entity/${encodeURIComponent(r.slug)}`}>{r.name || r.slug}</Link>
                    ),
                  },
                  { key: 'entity_subtype', header: 'Type', hideOn: 'narrow' },
                ]}
                rows={data.children}
                rowKey="slug"
                searchPlaceholder="Search…"
              />
            </div>
          </Card>
        </>
      )}
    </>
  );
}

/** One capability: its single row, or its list of rows. */
function CapabilityEditor({ slug, capability, state, amenityCatalog, onChanged }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const columns = capability.columns || [];

  const saveSingle = async (values) => {
    await api.put(endpoints.bookingPlatform.listingOperations(slug), {
      record: toRecord(columns, values),
    });
    toast.success(`Saved to ${capability.table}.`);
    onChanged();
  };

  const add = async (values) => {
    await api.post(endpoints.bookingPlatform.listingRows(slug, capability.key), toRecord(columns, values));
    toast.success(`Added to ${capability.table}.`);
    setAdding(false);
    onChanged();
  };

  const update = async (values) => {
    await api.patch(endpoints.bookingPlatform.capabilityRow(capability.key, editing.id), toRecord(columns, values));
    toast.success('Saved.');
    setEditing(null);
    onChanged();
  };

  const remove = async (row) => {
    try {
      await api.del(endpoints.bookingPlatform.capabilityRow(capability.key, row.id));
      toast.success('Removed.');
      onChanged();
    } catch (err) {
      toast.error(err.message, 'Could not remove');
    }
  };

  if (capability.single) {
    return (
      <Card title={capability.label} subtitle={`${capability.hint} Writes to ${capability.table}.`}>
        <SchemaForm
          key={`${slug}-${capability.key}`}
          schema={toSchema(columns)}
          initialValues={toValues(columns, state?.row)}
          submitLabel="Save"
          onSubmit={saveSingle}
        />
      </Card>
    );
  }

  const rows = state?.rows || [];
  const preview = columns.filter((c) => c.search || c.required).slice(0, 5);

  return (
    <>
      <Card
        padded={false}
        title={capability.label}
        subtitle={`${capability.hint} Rows in ${capability.table}.`}
        actions={
          <Button size="sm" variant="primary" onClick={() => { setAdding((v) => !v); setEditing(null); }}>
            {adding ? 'Cancel' : `Add ${capability.label.replace(/s$/, '').toLowerCase()}`}
          </Button>
        }
      >
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          {adding && (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <SchemaForm schema={toSchema(columns)} submitLabel="Add" onSubmit={add} onCancel={() => setAdding(false)} />
            </div>
          )}
          {editing && (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <SchemaForm
                key={editing.id}
                schema={toSchema(columns)}
                initialValues={toValues(columns, editing)}
                submitLabel="Save"
                onSubmit={update}
                onCancel={() => setEditing(null)}
              />
            </div>
          )}
          {rows.length === 0 && !adding ? (
            <p className="muted">Nothing here yet.</p>
          ) : (
            <DataTable
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  render: (r) => r.name || <span className="faint">untitled</span>,
                },
                ...preview.filter((c) => c.name !== 'name').map((c) => ({
                  key: c.name,
                  header: c.label,
                  hideOn: c.required ? undefined : 'narrow',
                  render: (r) => {
                    const v = r[c.name];
                    if (v === null || v === undefined || v === '') return <span className="faint">—</span>;
                    if (typeof v === 'boolean') return v ? <Badge tone="success">yes</Badge> : <Badge tone="neutral">no</Badge>;
                    return `${v}${c.unit && c.unit !== '$' ? ` ${c.unit}` : ''}`;
                  },
                })),
                {
                  key: '__actions',
                  header: '',
                  align: 'right',
                  sortable: false,
                  searchable: false,
                  stopPropagation: true,
                  render: (r) => (
                    <span className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <Button size="sm" onClick={() => { setEditing(r); setAdding(false); }}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => remove(r)}>Remove</Button>
                    </span>
                  ),
                },
              ]}
              rows={rows}
              rowKey="id"
              searchPlaceholder={`Search ${capability.label.toLowerCase()}…`}
            />
          )}
        </div>
      </Card>

      {/* Amenities and children hang off a specific row, so they only make
          sense once one is selected. */}
      {rows.map((row) => (
        <RowExtras
          key={row.id}
          slug={slug}
          capability={capability}
          row={row}
          chosen={state?.amenities?.[row.id] || []}
          children={state?.children?.[row.id] || {}}
          amenityCatalog={amenityCatalog}
          onChanged={onChanged}
        />
      ))}
    </>
  );
}

/** Amenities and child rows for one boat, unit or space. */
function RowExtras({ slug, capability, row, chosen, children, amenityCatalog, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [addingTo, setAddingTo] = useState(null);
  const has = new Set(chosen);

  const hasExtras = capability.amenities || (capability.children || []).length > 0;
  if (!hasExtras) return null;

  const toggle = async (amenityId) => {
    const next = new Set(has);
    if (next.has(amenityId)) next.delete(amenityId); else next.add(amenityId);
    setBusy(true);
    try {
      await api.put(endpoints.bookingPlatform.rowAmenities(capability.key, row.id), { amenity_ids: [...next] });
      onChanged();
    } catch (err) {
      toast.error(err.message, 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const addChild = async (child, values) => {
    const record = {};
    for (const c of child.columns) {
      const v = values[c.name];
      if (v !== '' && v !== undefined) record[c.name] = v;
    }
    await api.post(endpoints.bookingPlatform.rowChildren(capability.key, row.id, child.table), record);
    toast.success(`Added to ${child.table}.`);
    setAddingTo(null);
    onChanged();
  };

  const removeChild = async (child, kid) => {
    try {
      await api.del(endpoints.bookingPlatform.childRow(child.table, kid.id));
      toast.success('Removed.');
      onChanged();
    } catch (err) {
      toast.error(err.message, 'Could not remove');
    }
  };

  return (
    <>
      <div style={{ height: 'var(--space-4)' }} />
      <Card title={row.name || `${capability.label.replace(/s$/, '')} details`} subtitle={`For this row only`}>
        {capability.amenities && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div className="ui-form__legend" style={{ marginBottom: 6 }}>
              Amenities {busy && <Badge tone="info">saving…</Badge>}
            </div>
            {(amenityCatalog?.groups || []).map((group) => (
              <div key={group.category} style={{ marginBottom: 'var(--space-3)' }}>
                <div className="ui-field__label">{prettify(group.category)}</div>
                <div className="row-wrap" style={{ gap: 4 }}>
                  {group.items.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      disabled={busy}
                      className={`ui-multi__chip ${has.has(a.id) ? 'is-active' : ''}`}
                      onClick={() => toggle(a.id)}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {(capability.children || []).map((child) => {
          const kids = children[child.table] || [];
          return (
            <div key={child.table} style={{ marginTop: 'var(--space-4)' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div className="ui-form__legend">{child.label}</div>
                <Button size="sm" onClick={() => setAddingTo(addingTo === child.table ? null : child.table)}>
                  {addingTo === child.table ? 'Cancel' : 'Add'}
                </Button>
              </div>
              {addingTo === child.table && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <SchemaForm
                    schema={toSchema(child.columns)}
                    submitLabel="Add"
                    onSubmit={(values) => addChild(child, values)}
                    onCancel={() => setAddingTo(null)}
                  />
                </div>
              )}
              {kids.length === 0 ? (
                <p className="muted">None.</p>
              ) : (
                <div className="row-wrap" style={{ gap: 6 }}>
                  {kids.map((kid, i) => (
                    <span key={kid.id ?? i} className="row" style={{ gap: 4, alignItems: 'center' }}>
                      <Badge tone="info">
                        {child.columns.map((c) => kid[c.name]).filter(Boolean).map(prettify).join(' · ')}
                      </Badge>
                      {!child.no_id && (
                        <Button size="sm" variant="link" onClick={() => removeChild(child, kid)}>×</Button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </>
  );
}

/** Amenities, species and activities attached to the business itself. */
function EntityLists({ slug, lists, values, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);

  return (
    <>
      {lists.map((list) => (
        <EntityListCard
          key={list.key}
          slug={slug}
          list={list}
          chosen={values[list.key] || []}
          busy={busy === list.key}
          onSave={async (ids) => {
            setBusy(list.key);
            try {
              await api.put(endpoints.bookingPlatform.listingList(slug, list.key), { ids });
              onChanged();
            } catch (err) {
              toast.error(err.message, 'Could not save');
            } finally {
              setBusy(null);
            }
          }}
        />
      ))}
    </>
  );
}

function EntityListCard({ slug, list, chosen, busy, onSave }) {
  const catalog = useAsync(
    async () => api.get(endpoints.bookingPlatform.catalog(list.catalog)),
    [list.catalog],
    { initialData: null },
  );
  const has = new Set(chosen);

  return (
    <>
      <Card
        title={`${list.label} — the business itself`}
        subtitle={`Rows in ${list.join}. A catalog and a join, never free text.`}
        actions={busy && <Badge tone="info">saving…</Badge>}
      >
        {catalog.loading && <LoadingBlock />}
        {(catalog.data?.groups || []).map((group) => (
          <div key={group.category} style={{ marginBottom: 'var(--space-3)' }}>
            <div className="ui-field__label">{prettify(group.category)}</div>
            <div className="row-wrap" style={{ gap: 4 }}>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={busy}
                  className={`ui-multi__chip ${has.has(item.id) ? 'is-active' : ''}`}
                  onClick={() => {
                    const next = new Set(has);
                    if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                    onSave([...next]);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </Card>
      <div style={{ height: 'var(--space-4)' }} />
    </>
  );
}
