/**
 * Offerings — the booking catalog.
 *
 * A fishing charter, a dolphin cruise, a pontoon rental, a condo, an add-on:
 * all of them are `offerings` rows. `kind` says which app it belongs to and
 * `unit` says how it is priced, so a new product type is data, not a table.
 *
 * GET/POST /api/admin/platform/offerings
 * PUT/DELETE /api/admin/platform/offerings/:id
 * GET/POST /api/admin/platform/offerings/:id/prices
 */

import { useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { Modal, useConfirm } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { OFFERING_KINDS, OFFERING_UNITS } from '../../api/bookingResources.js';
import { columns, fields, formatMoney } from '../../lib/fields.jsx';

const offeringSchema = {
  groups: [
    {
      title: 'What it is',
      fields: [
        fields.text('name', 'Name', {
          required: true,
          span: 2,
          placeholder: 'Half-Day Inshore Charter',
        }),
        fields.textarea('description', 'Description', { rows: 3 }),
        fields.select('kind', 'Kind', OFFERING_KINDS, {
          required: true,
          help: 'Which booking app this belongs to.',
        }),
        fields.text('section', 'Section', {
          placeholder: 'services, fleet_items, properties…',
          help: 'The dataKey the owner dashboard files it under.',
        }),
      ],
    },
    {
      title: 'Pricing & capacity',
      fields: [
        fields.select('unit', 'Priced per', OFFERING_UNITS, { required: true }),
        fields.money('price_from', 'Price from', {
          help: 'The headline price. Tiered pricing goes in Prices.',
        }),
        fields.number('capacity', 'Capacity', {
          min: 0,
          step: 1,
          help: 'Maximum guests, or sleeps for a property.',
        }),
        fields.sortOrder(),
      ],
    },
    {
      title: 'Visibility',
      fields: [
        fields.bool('active', 'Bookable', {
          defaultValue: true,
          checkboxLabel: 'Available to book',
        }),
      ],
    },
  ],
};

const priceSchema = [
  fields.text('label', 'Label', { required: true, span: 2, placeholder: 'Adult, Child, Off-peak' }),
  fields.money('amount', 'Amount', { required: true }),
  fields.select('unit', 'Per', OFFERING_UNITS),
  fields.number('min_qty', 'Minimum qty', { min: 0, step: 1 }),
  fields.number('max_qty', 'Maximum qty', { min: 0, step: 1 }),
  fields.sortOrder(),
];

export default function Offerings() {
  const [slug, setSlug] = useState(null);
  const [kind, setKind] = useState('');
  const [pricesFor, setPricesFor] = useState(null);

  const query = useMemo(
    () => ({ slug: slug || undefined, kind: kind || undefined, limit: 500 }),
    [slug, kind],
  );

  const { data, loading, error, reload } = useAsync(
    async () => unwrapList(await api.get(endpoints.bookingPlatform.offerings(), { query }), ['offerings']),
    [query],
    { initialData: [] },
  );

  const offerings = data || [];
  const [editing, setEditing] = useState(null);
  const [confirm, confirmElement] = useConfirm();
  const toast = useToast();

  const save = async (values) => {
    const payload = { ...values, entity_slug: editing.entity_slug || slug };
    if (!payload.entity_slug) {
      toast.warning('Pick a business first.');
      return;
    }
    if (editing.id) await api.put(endpoints.bookingPlatform.offering(editing.id), payload);
    else await api.post(endpoints.bookingPlatform.offerings(), payload);
    toast.success(`${values.name} saved.`);
    setEditing(null);
    await reload();
  };

  const remove = async (row) => {
    const ok = await confirm({
      title: 'Delete offering',
      message: `Delete “${row.name}”? Bookings already taken against it are not removed.`,
    });
    if (!ok) return;
    try {
      await api.del(endpoints.bookingPlatform.offering(row.id));
      toast.success('Offering deleted.', 'Deleted');
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  const stats = useMemo(() => {
    const active = offerings.filter((o) => o.active !== false).length;
    const byKind = new Map();
    for (const o of offerings) byKind.set(o.kind, (byKind.get(o.kind) || 0) + 1);
    return { total: offerings.length, active, byKind: [...byKind.entries()] };
  }, [offerings]);

  return (
    <>
      <PageHeader
        title="Offerings"
        description="The booking catalog — charters, cruises, rentals, rooms, and add-ons across every business."
        actions={
          <>
            <Button onClick={reload} disabled={loading}>Refresh</Button>
            <Button variant="primary" onClick={() => setEditing({ entity_slug: slug || '' })}>
              Add offering
            </Button>
          </>
        }
      />

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="Offerings" value={loading ? '…' : stats.total} tone="primary" />
        <Stat label="Bookable" value={loading ? '…' : stats.active} tone="success" />
        {stats.byKind.slice(0, 4).map(([k, n]) => (
          <Stat key={k} label={k || 'unclassified'} value={n} />
        ))}
      </div>

      <Card padded={false}>
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <DataTable
            columns={[
              {
                key: 'name',
                header: 'Offering',
                render: (row) => (
                  <div>
                    <div className="ui-cell-primary">{row.name}</div>
                    <div className="ui-cell-sub">{row.entity_name || row.entity_slug}</div>
                  </div>
                ),
              },
              {
                key: 'kind',
                header: 'Kind',
                render: (row) => <Badge tone="info">{row.kind || 'offering'}</Badge>,
              },
              {
                key: 'price_from',
                header: 'From',
                align: 'right',
                render: (row) =>
                  row.price_from != null ? (
                    <>
                      {formatMoney(row.price_from)}
                      <span className="faint"> /{row.unit || 'flat'}</span>
                    </>
                  ) : (
                    <span className="faint">—</span>
                  ),
              },
              columns.number('capacity', 'Capacity'),
              {
                key: 'active',
                header: 'Status',
                render: (row) =>
                  row.active === false ? <Badge>Off</Badge> : <Badge tone="success">Bookable</Badge>,
              },
              {
                key: '__actions',
                header: '',
                align: 'right',
                sortable: false,
                searchable: false,
                stopPropagation: true,
                render: (row) => (
                  <span className="ui-cell-actions">
                    <Button size="sm" onClick={() => setPricesFor(row)}>Prices</Button>
                    <Button size="sm" onClick={() => setEditing(row)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => remove(row)}>Delete</Button>
                  </span>
                ),
              },
            ]}
            rows={offerings}
            loading={loading}
            error={error}
            onRetry={reload}
            searchPlaceholder="Search offerings…"
            emptyTitle="No offerings"
            emptyDescription={
              slug
                ? 'This business has nothing in its booking catalog yet.'
                : 'Nothing in the booking catalog across any business.'
            }
            emptyAction={
              <Button variant="primary" onClick={() => setEditing({ entity_slug: slug || '' })}>
                Add offering
              </Button>
            }
            toolbar={
              <>
                <div style={{ minWidth: 230, flex: 1, maxWidth: 320 }}>
                  <EntityPicker
                    value={slug}
                    onChange={setSlug}
                    label={null}
                    placeholder="All businesses…"
                  />
                </div>
                <select
                  className="ui-input ui-input--select"
                  style={{ width: 'auto' }}
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="">All kinds</option>
                  {OFFERING_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
              </>
            }
          />
        </div>
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        size="lg"
        title={editing?.id ? 'Edit offering' : 'Add offering'}
      >
        {editing && (
          <div className="stack">
            {!editing.id && (
              <EntityPicker
                value={editing.entity_slug || slug || null}
                onChange={(next) => setEditing((prev) => ({ ...prev, entity_slug: next }))}
                label="Business"
              />
            )}
            <SchemaForm
              schema={offeringSchema}
              initialValues={{ kind: 'service', unit: 'person', active: true, ...editing }}
              onSubmit={save}
              onCancel={() => setEditing(null)}
              submitLabel={editing.id ? 'Save offering' : 'Create offering'}
            />
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(pricesFor)}
        onClose={() => setPricesFor(null)}
        size="lg"
        title={pricesFor ? `Prices — ${pricesFor.name}` : ''}
        description="Tiered or per-person pricing. The offering's own price is the headline figure."
      >
        {pricesFor && <PriceList offering={pricesFor} confirm={confirm} />}
      </Modal>

      {confirmElement}
    </>
  );
}

/** Prices attached to one offering. */
function PriceList({ offering, confirm }) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);

  const { data, loading, error, reload } = useAsync(
    async () =>
      unwrapList(await api.get(endpoints.bookingPlatform.offeringPrices(offering.id)), ['prices']),
    [offering.id],
    { initialData: [] },
  );

  const prices = data || [];

  const save = async (values) => {
    if (editing.id) await api.put(endpoints.bookingPlatform.offeringPrice(editing.id), values);
    else await api.post(endpoints.bookingPlatform.offeringPrices(offering.id), values);
    toast.success('Price saved.');
    setEditing(null);
    await reload();
  };

  const remove = async (row) => {
    const ok = await confirm({ title: 'Delete price', message: `Delete “${row.label}”?` });
    if (!ok) return;
    try {
      await api.del(endpoints.bookingPlatform.offeringPrice(row.id));
      toast.success('Price deleted.', 'Deleted');
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <div className="stack">
      {loading && <LoadingBlock />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && prices.length === 0 && (
        <EmptyState
          icon="🏷️"
          title="No tiered prices"
          description={`Bookings use the headline price of ${formatMoney(offering.price_from) || '—'}.`}
        />
      )}

      {!loading && !error && prices.length > 0 && (
        <ul className="sec-editor__items">
          {prices.map((price) => (
            <li className="sec-editor__item" key={price.id}>
              <div className="sec-editor__itembody">
                <div className="sec-editor__itemname">{price.label}</div>
                <div className="sec-editor__itemdesc mono">
                  {[
                    price.unit && `per ${price.unit}`,
                    price.min_qty != null && `min ${price.min_qty}`,
                    price.max_qty != null && `max ${price.max_qty}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <div className="sec-editor__price">{formatMoney(price.amount)}</div>
              <div className="row" style={{ gap: 6 }}>
                <Button size="sm" onClick={() => setEditing(price)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => remove(price)}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <SchemaForm
          schema={priceSchema}
          initialValues={editing}
          onSubmit={save}
          onCancel={() => setEditing(null)}
          submitLabel={editing.id ? 'Save price' : 'Add price'}
        />
      ) : (
        <div>
          <Button variant="primary" onClick={() => setEditing({ sort_order: prices.length })}>
            Add a price tier
          </Button>
        </div>
      )}
    </div>
  );
}
