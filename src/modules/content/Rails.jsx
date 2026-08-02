/**
 * Page rails — the curated carousels on each public page, and the entities
 * pinned into each one.
 *
 * Rails:      GET/POST /api/admin/gcr/page-rails, PUT/DELETE /:id
 * Rail slots: GET/POST /api/admin/gcr/page-rails/:id/items,
 *             PUT/DELETE /api/admin/gcr/page-rail-items/:id
 */

import { useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { Modal, useConfirm } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { EntityPicker, useEntities } from '../../components/EntityPicker.jsx';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, fields } from '../../lib/fields.jsx';
import { GCR_PAGES } from '../directory/entitySchema.js';

const railSchema = {
  groups: [
    {
      title: 'Rail',
      fields: [
        fields.select('page', 'Page', GCR_PAGES, {
          required: true,
          help: 'Which public page this rail appears on.',
        }),
        fields.text('title', 'Title', { required: true }),
        fields.text('eyebrow', 'Eyebrow', { placeholder: 'Small label above the title' }),
        fields.text('emoji', 'Emoji'),
      ],
    },
    {
      title: 'Behaviour',
      fields: [
        fields.select('rail_type', 'Rail type', [
          { value: 'manual', label: 'Manual — pinned entities only' },
          { value: 'algorithm', label: 'Algorithmic — filled automatically' },
        ]),
        fields.text('algorithm', 'Algorithm', {
          placeholder: 'top_rated, newest, featured…',
          visible: (values) => values.rail_type === 'algorithm',
        }),
        fields.text('category', 'Category filter'),
        fields.number('card_limit', 'Card limit', { min: 1, step: 1 }),
        fields.sortOrder(),
        fields.bool('is_active', 'Active', { defaultValue: true }),
      ],
    },
  ],
};

const slotSchema = [
  fields.sortOrder(),
  fields.text('badge_text', 'Badge text', { placeholder: 'New, Popular…' }),
  fields.bool('is_ad', 'Paid placement', { checkboxLabel: 'Mark as an ad' }),
  fields.datetime('starts_at', 'Starts at'),
  fields.datetime('ends_at', 'Ends at'),
];

export default function Rails() {
  const toast = useToast();
  const [pageFilter, setPageFilter] = useState('');
  const [editingRail, setEditingRail] = useState(null);
  const [openRail, setOpenRail] = useState(null);
  const [confirm, confirmElement] = useConfirm();

  const { data, loading, error, reload } = useAsync(
    async () => unwrapList(await api.get(endpoints.rails.list()), ['rails']),
    [],
    { initialData: [] },
  );

  const rails = data || [];
  const rows = useMemo(
    () => (pageFilter ? rails.filter((r) => r.page === pageFilter) : rails),
    [rails, pageFilter],
  );

  const saveRail = async (values) => {
    if (editingRail?.id) await api.put(endpoints.rails.update(editingRail.id), values);
    else await api.post(endpoints.rails.create(), values);
    toast.success('Rail saved.');
    setEditingRail(null);
    await reload();
  };

  const removeRail = async (rail) => {
    const ok = await confirm({
      title: 'Delete rail',
      message: `Delete “${rail.title}” from the ${rail.page} page?`,
    });
    if (!ok) return;
    try {
      await api.del(endpoints.rails.remove(rail.id));
      toast.success('Rail deleted.', 'Deleted');
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <>
      <PageHeader
        title="Page rails"
        description="The carousels on each public page. Manual rails hold pinned businesses; algorithmic rails fill themselves."
        actions={
          <>
            <Button onClick={reload} disabled={loading}>Refresh</Button>
            <Button variant="primary" onClick={() => setEditingRail({ page: pageFilter || '' })}>
              Add rail
            </Button>
          </>
        }
      />

      <Card padded={false}>
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <DataTable
            columns={[
              {
                key: 'title',
                header: 'Rail',
                render: (row) => (
                  <div>
                    <div className="ui-cell-primary">
                      {row.emoji ? `${row.emoji} ` : ''}
                      {row.title}
                    </div>
                    {row.eyebrow && <div className="ui-cell-sub">{row.eyebrow}</div>}
                  </div>
                ),
              },
              columns.text('page', 'Page'),
              {
                key: 'rail_type',
                header: 'Type',
                render: (row) =>
                  row.rail_type === 'algorithm' ? (
                    <Badge tone="info">{row.algorithm || 'algorithmic'}</Badge>
                  ) : (
                    <Badge>manual</Badge>
                  ),
              },
              columns.number('card_limit', 'Limit'),
              columns.number('sort_order', 'Order'),
              columns.bool('is_active', 'Active'),
              {
                key: '__actions',
                header: '',
                align: 'right',
                sortable: false,
                searchable: false,
                stopPropagation: true,
                render: (row) => (
                  <span className="ui-cell-actions">
                    <Button size="sm" onClick={() => setOpenRail(row)}>Slots</Button>
                    <Button size="sm" onClick={() => setEditingRail(row)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => removeRail(row)}>Delete</Button>
                  </span>
                ),
              },
            ]}
            rows={rows}
            loading={loading}
            error={error}
            onRetry={reload}
            searchPlaceholder="Search rails…"
            emptyTitle="No rails"
            emptyDescription="No curated carousels have been set up yet."
            initialSort={{ key: 'sort_order', direction: 'asc' }}
            toolbar={
              <select
                className="ui-input ui-input--select"
                style={{ width: 'auto' }}
                value={pageFilter}
                onChange={(e) => setPageFilter(e.target.value)}
              >
                <option value="">All pages</option>
                {GCR_PAGES.map((page) => (
                  <option key={page.value} value={page.value}>{page.label}</option>
                ))}
              </select>
            }
          />
        </div>
      </Card>

      <Modal
        open={Boolean(editingRail)}
        onClose={() => setEditingRail(null)}
        size="lg"
        title={editingRail?.id ? 'Edit rail' : 'Add rail'}
      >
        {editingRail && (
          <SchemaForm
            schema={railSchema}
            initialValues={{ rail_type: 'manual', is_active: true, ...editingRail }}
            onSubmit={saveRail}
            onCancel={() => setEditingRail(null)}
            submitLabel={editingRail.id ? 'Save rail' : 'Create rail'}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(openRail)}
        onClose={() => setOpenRail(null)}
        size="lg"
        title={openRail ? `Slots — ${openRail.title}` : ''}
        description={openRail?.page}
      >
        {openRail && <RailSlots rail={openRail} confirm={confirm} />}
      </Modal>

      {confirmElement}
    </>
  );
}

/** The entities pinned into one rail. */
function RailSlots({ rail, confirm }) {
  const toast = useToast();
  const { entities } = useEntities();
  const [adding, setAdding] = useState(null);
  const [editing, setEditing] = useState(null);

  const { data, loading, error, reload } = useAsync(
    async () => unwrapList(await api.get(endpoints.rails.items(rail.id)), ['items']),
    [rail.id],
    { initialData: [] },
  );

  const items = data || [];
  const nameBySlug = useMemo(
    () => Object.fromEntries(entities.map((e) => [e.slug, e.name])),
    [entities],
  );

  const addSlot = async (values) => {
    await api.post(endpoints.rails.items(rail.id), { ...values, entity_slug: adding.entity_slug });
    toast.success('Slot added.');
    setAdding(null);
    await reload();
  };

  const updateSlot = async (values) => {
    await api.put(endpoints.rails.item(editing.id), values);
    toast.success('Slot updated.');
    setEditing(null);
    await reload();
  };

  const removeSlot = async (item) => {
    const ok = await confirm({
      title: 'Remove slot',
      message: `Remove ${nameBySlug[item.entity_slug] || item.entity_slug} from this rail?`,
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    try {
      await api.del(endpoints.rails.item(item.id));
      toast.success('Slot removed.', 'Removed');
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  if (rail.rail_type === 'algorithm') {
    return (
      <EmptyState
        icon="⚙️"
        title="Algorithmic rail"
        description={`This rail fills itself using “${rail.algorithm || 'its algorithm'}”. Pinned slots do not apply.`}
      />
    );
  }

  return (
    <div className="stack">
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <LoadingBlock />}

      {!loading && !error && (
        <>
          {items.length === 0 ? (
            <EmptyState icon="📌" title="No pinned businesses" description="Add one below." />
          ) : (
            <ul className="sec-editor__items">
              {items
                .slice()
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map((item) => (
                  <li className="sec-editor__item" key={item.id}>
                    <div className="sec-editor__itembody">
                      <div className="sec-editor__itemname">
                        {nameBySlug[item.entity_slug] || item.entity_slug}
                        {item.is_ad && <Badge tone="warning">Ad</Badge>}
                        {item.badge_text && <Badge tone="info">{item.badge_text}</Badge>}
                      </div>
                      <div className="sec-editor__itemdesc mono">
                        #{item.sort_order ?? 0} · {item.entity_slug}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <Button size="sm" onClick={() => setEditing(item)}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => removeSlot(item)}>Remove</Button>
                    </div>
                  </li>
                ))}
            </ul>
          )}

          <div className="stack-sm">
            <EntityPicker
              value={adding?.entity_slug || null}
              onChange={(slug) => setAdding(slug ? { entity_slug: slug } : null)}
              label="Add a business to this rail"
            />
            {adding?.entity_slug && (
              <SchemaForm
                schema={slotSchema}
                initialValues={{ sort_order: items.length }}
                onSubmit={addSlot}
                onCancel={() => setAdding(null)}
                submitLabel="Pin to rail"
              />
            )}
          </div>
        </>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit slot">
        {editing && (
          <SchemaForm
            schema={slotSchema}
            initialValues={editing}
            onSubmit={updateSlot}
            onCancel={() => setEditing(null)}
            submitLabel="Save slot"
          />
        )}
      </Modal>
    </div>
  );
}
