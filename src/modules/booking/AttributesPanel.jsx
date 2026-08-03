/**
 * Structured listing data for one business — the real industry tables.
 *
 * `entity` holds what every business has. What it cannot hold is bedrooms,
 * boat length, or whether there is a head on board, so each industry has real
 * tables with real columns: `stay_units.bedrooms`, `charter_boats.length_ft`,
 * `venue_spaces.seated_capacity`.
 *
 * The form is not written here. It is built from the blueprint the API serves
 * for this business's industry, and a build-time check in gcr-api-clean fails
 * if that blueprint ever names a column the SQL does not create. So there is
 * no hand-kept field list to drift, and no way for the form to offer a field
 * the database would reject.
 *
 * A condo complex is one entity and each unit is its own entity — the
 * separation that already exists. The building's row goes in
 * `stay_properties`, each unit's in `stay_units`, and this panel edits
 * whichever one applies to the slug it was given.
 *
 * GET/PUT /api/admin/platform/listing/:slug
 * PUT     /api/admin/platform/listing/:slug/amenities
 * PUT     /api/admin/platform/listing/:slug/tags/:catalog
 * GET     /api/admin/platform/amenities
 */

import { useMemo, useState } from 'react';
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

/** Blueprint column → SchemaForm field. */
function toFormField(column) {
  const help = [
    column.unit && column.unit !== '$' ? `In ${column.unit}.` : null,
    column.search === 'min' ? 'Guests filter on “at least this”.'
      : column.search === 'max' ? 'Guests filter on “at most this”.'
        : column.search === 'has' ? 'Guests filter on this being true.'
          : column.search === 'any' ? 'Guests filter on this.'
            : column.search === 'eq' ? 'Guests filter on an exact match.'
              : null,
  ].filter(Boolean).join(' ') || undefined;
  const extra = { help, required: column.required || undefined };

  switch (column.type) {
    case 'int':
      return f.number(column.name, column.label, { min: 0, step: 1, ...extra });
    case 'decimal':
      return f.number(column.name, column.label, { min: 0, step: column.step || 0.01, ...extra });
    case 'bool':
      return f.bool(column.name, column.label, extra);
    case 'time':
      return f.time(column.name, column.label, extra);
    case 'enum':
      return f.select(
        column.name,
        column.label,
        [{ value: '', label: '—' }, ...(column.options || []).map((o) => ({ value: o, label: prettify(o) }))],
        extra,
      );
    default:
      return column.long
        ? f.textarea(column.name, column.label, extra)
        : f.text(column.name, column.label, extra);
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

function toFormValues(columns, record) {
  const out = {};
  for (const column of columns) {
    const value = record ? record[column.name] : undefined;
    if (value === undefined || value === null) {
      out[column.name] = column.type === 'bool' ? false : '';
    } else if (column.type === 'time' && typeof value === 'string') {
      out[column.name] = value.slice(0, 5);           // 16:00:00 → 16:00
    } else {
      out[column.name] = value;
    }
  }
  return out;
}

export default function AttributesPanel({ slug }) {
  const toast = useToast();
  const [savingAmenities, setSavingAmenities] = useState(false);

  const query = useAsync(
    async () => (slug ? api.get(endpoints.bookingPlatform.listing(slug)) : null),
    [slug],
    { initialData: null },
  );

  const data = query.data;

  const blueprintQuery = useAsync(
    async () => (data?.vertical ? api.get(endpoints.bookingPlatform.blueprint(data.vertical)) : null),
    [data?.vertical],
    { initialData: null },
  );

  const catalogQuery = useAsync(
    async () => api.get(endpoints.bookingPlatform.amenityCatalog()),
    [],
    { initialData: null },
  );

  const spec = useMemo(() => {
    if (!blueprintQuery.data || !data) return null;
    return data.level === 'unit' ? blueprintQuery.data.unit : blueprintQuery.data.listing;
  }, [blueprintQuery.data, data]);

  const columns = spec?.columns || [];
  const chosenAmenities = new Set(data?.amenities || []);

  const save = async (values) => {
    const record = {};
    for (const column of columns) {
      const value = values[column.name];
      record[column.name] = value === '' || value === undefined ? null : value;
    }
    await api.put(endpoints.bookingPlatform.listing(slug), { record });
    toast.success(`Saved to ${spec.table}.`);
    query.reload();
  };

  const toggleAmenity = async (amenityId) => {
    if (!data?.record) {
      toast.warning('Save the details first — amenities attach to that row.');
      return;
    }
    const next = new Set(chosenAmenities);
    if (next.has(amenityId)) next.delete(amenityId); else next.add(amenityId);
    setSavingAmenities(true);
    try {
      await api.put(endpoints.bookingPlatform.listingAmenities(slug), { amenity_ids: [...next] });
      query.reload();
    } catch (err) {
      toast.error(err.message, 'Could not save amenities');
    } finally {
      setSavingAmenities(false);
    }
  };

  if (!slug) {
    return <EmptyState icon="📐" title="No business selected" description="Pick a business to edit its listing data." />;
  }
  if (query.loading && !data) return <LoadingBlock />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.reload} />;
  if (!data) return null;

  if (!data.supported) {
    return (
      <EmptyState
        icon="🏷️"
        title={`No industry tables for “${data.vertical}”`}
        description={data.reason || 'Add them to sql/industry_tables.sql and describe them in routes/industry-blueprints.js.'}
      />
    );
  }

  const missing = data.missing_required || [];
  const filled = data.record ? Object.values(data.record).filter((v) => v !== null && v !== '').length : 0;

  return (
    <>
      <Notice tone="info" title="Real columns, not a blob">
        <p>
          This writes to <code className="mono">{data.table}</code> — a real table with real typed
          columns, so &ldquo;two bedroom two bath&rdquo; is an indexed integer comparison. Try it in{' '}
          <Link to="/booking/match">Find a Match</Link>.
        </p>
        {data.level === 'unit' && (
          <p style={{ marginTop: 8 }}>
            This is a unit of <strong>{data.parent_name}</strong>. The building&apos;s own details —
            pool, floors, front desk — live on{' '}
            <Link to={`/directory/entity/${encodeURIComponent(data.parent_slug)}`}>its page</Link>.
          </p>
        )}
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="Industry" value={data.vertical} hint={data.level === 'unit' ? data.unit_label : 'the property'} />
        <Stat label="Table" value={data.table} />
        <Stat label="Fields on file" value={filled} tone={filled ? 'success' : 'warning'} />
        <Stat
          label="Required blank"
          value={missing.length}
          tone={missing.length ? 'warning' : 'success'}
          hint={missing.length ? missing.map((m) => m.label).join(', ') : undefined}
        />
      </div>

      {blueprintQuery.loading && <LoadingBlock />}

      {columns.length > 0 && (
        <Card
          title={spec.label}
          subtitle={`Writes to ${spec.table}`}
          actions={<Button size="sm" onClick={query.reload} loading={query.loading}>Reload</Button>}
        >
          <SchemaForm
            key={`${slug}-${spec.table}`}
            schema={toSchema(columns)}
            initialValues={toFormValues(columns, data.record)}
            submitLabel="Save"
            onSubmit={save}
          />
        </Card>
      )}

      {spec?.amenities && (
        <>
          <div style={{ height: 'var(--space-5)' }} />
          <Card
            title="Amenities"
            subtitle={
              data.record
                ? `Grouped the way guests already know them. Saved to ${spec.amenities.join} as you click.`
                : 'Save the details above first — amenities attach to that row.'
            }
            actions={savingAmenities && <Badge tone="info">Saving…</Badge>}
          >
            {catalogQuery.loading && <LoadingBlock />}
            {catalogQuery.data?.sections?.map((section) => (
              section.amenities.length > 0 && (
                <div key={section.key} style={{ marginBottom: 'var(--space-4)' }}>
                  <div className="ui-form__legend" style={{ marginBottom: 6 }}>{section.label}</div>
                  <div className="row-wrap" style={{ gap: 4 }}>
                    {section.amenities.map((amenity) => (
                      <button
                        key={amenity.id}
                        type="button"
                        disabled={!data.record || savingAmenities}
                        className={`ui-multi__chip ${chosenAmenities.has(amenity.id) ? 'is-active' : ''}`}
                        onClick={() => toggleAmenity(amenity.id)}
                      >
                        {amenity.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            ))}
          </Card>
        </>
      )}

      {(spec?.collections || []).map((coll) => (
        <CollectionCard
          key={coll.table}
          slug={slug}
          coll={coll}
          rows={data.collections?.[coll.table] || []}
          enabled={!!data.record}
          onChanged={query.reload}
        />
      ))}

      {Array.isArray(data.units) && data.units.length > 0 && (
        <>
          <div style={{ height: 'var(--space-5)' }} />
          <Card
            padded={false}
            title={`${data.unit_label}s`}
            subtitle="Each is its own entity with its own row — that is where the searchable facts live."
          >
            <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
              <DataTable
                columns={[
                  {
                    key: 'entity_name',
                    header: data.unit_label,
                    render: (u) => (
                      <Link to={`/directory/entity/${encodeURIComponent(u.entity_slug)}`}>
                        {u.entity_name || u.entity_slug}
                      </Link>
                    ),
                  },
                  {
                    key: 'has_row',
                    header: 'Filled in',
                    render: (u) =>
                      u.has_row ? <Badge tone="success">Yes</Badge> : <Badge tone="warning">Not yet</Badge>,
                  },
                  {
                    key: 'missing_required',
                    header: 'Still blank',
                    sortable: false,
                    hideOn: 'narrow',
                    render: (u) =>
                      u.missing_required.length === 0
                        ? <span className="faint">—</span>
                        : <span style={{ fontSize: 12 }}>{u.missing_required.join(', ')}</span>,
                  },
                ]}
                rows={data.units}
                rowKey="entity_slug"
                searchPlaceholder="Search units…"
              />
            </div>
          </Card>
        </>
      )}
    </>
  );
}

/** Beds in a unit, trips a charter runs, packages a photographer sells. */
function CollectionCard({ slug, coll, rows, enabled, onChanged }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);

  const add = async (values) => {
    const record = {};
    for (const column of coll.columns) {
      const value = values[column.name];
      if (value !== '' && value !== undefined) record[column.name] = value;
    }
    await api.post(endpoints.bookingPlatform.listingCollection(slug, coll.table), record);
    toast.success(`Added to ${coll.table}.`);
    setAdding(false);
    onChanged();
  };

  const remove = async (row) => {
    try {
      await api.del(endpoints.bookingPlatform.collectionRow(coll.table, row.id));
      toast.success('Removed.');
      onChanged();
    } catch (err) {
      toast.error(err.message, 'Could not remove');
    }
  };

  return (
    <>
      <div style={{ height: 'var(--space-5)' }} />
      <Card
        padded={false}
        title={coll.label}
        subtitle={enabled ? `Rows in ${coll.table}` : 'Save the details above first.'}
        actions={
          enabled && (
            <Button size="sm" variant="primary" onClick={() => setAdding((v) => !v)}>
              {adding ? 'Cancel' : `Add ${coll.label.replace(/s$/, '').toLowerCase()}`}
            </Button>
          )
        }
      >
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          {adding && (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <SchemaForm
                schema={toSchema(coll.columns)}
                submitLabel="Add"
                onSubmit={add}
                onCancel={() => setAdding(false)}
              />
            </div>
          )}
          {rows.length === 0 ? (
            <p className="muted">Nothing here yet.</p>
          ) : (
            <DataTable
              columns={[
                ...coll.columns.slice(0, 6).map((column) => ({
                  key: column.name,
                  header: column.label,
                  hideOn: column.required ? undefined : 'narrow',
                  render: (row) => {
                    const v = row[column.name];
                    if (v === null || v === undefined || v === '') return <span className="faint">—</span>;
                    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
                    return `${v}${column.unit && column.unit !== '$' ? ` ${column.unit}` : ''}`;
                  },
                })),
                {
                  key: '__actions',
                  header: '',
                  align: 'right',
                  sortable: false,
                  searchable: false,
                  stopPropagation: true,
                  render: (row) => (
                    <Button size="sm" variant="danger" onClick={() => remove(row)}>Remove</Button>
                  ),
                },
              ]}
              rows={rows}
              rowKey="id"
              dense
            />
          )}
        </div>
      </Card>
    </>
  );
}
