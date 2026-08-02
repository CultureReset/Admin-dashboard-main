/**
 * GCR Businesses — the directory list.
 *
 * GET  /api/admin/gcr/entities
 * POST /api/admin/gcr/entities
 * Clicking a row opens the Entity Editor for that slug.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, PageHeader, Notice } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { Modal, useConfirm } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useEntities } from '../../components/EntityPicker.jsx';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns } from '../../lib/fields.jsx';
import { entityInfoSchema, ENTITY_TYPES, pickEntityFields } from './entitySchema.js';

export default function Businesses() {
  const { entities, loading, error, reload } = useEntities();
  const navigate = useNavigate();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [confirm, confirmElement] = useConfirm();

  const rows = useMemo(() => {
    let list = entities;
    if (typeFilter) list = list.filter((e) => e.entity_subtype === typeFilter || e.entity_type === typeFilter);
    if (activeFilter === 'active') list = list.filter((e) => e.is_active);
    if (activeFilter === 'inactive') list = list.filter((e) => !e.is_active);
    return list;
  }, [entities, typeFilter, activeFilter]);

  // Build the filter options from the data itself rather than a fixed list,
  // so new subtypes appear without a code change.
  const subtypeOptions = useMemo(() => {
    const seen = new Set();
    for (const entity of entities) {
      if (entity.entity_subtype) seen.add(entity.entity_subtype);
      if (entity.entity_type) seen.add(entity.entity_type);
    }
    return [...seen].sort();
  }, [entities]);

  const handleCreate = async (values) => {
    // POST /gcr/entities expects { entity, tags, hours }.
    await api.post(endpoints.entities.create(), { entity: pickEntityFields(values) });
    toast.success(`${values.name} created.`);
    setCreating(false);
    await reload();
    if (values.slug) navigate(`/directory/entity/${encodeURIComponent(values.slug)}`);
  };

  const handleDelete = async (entity) => {
    const ok = await confirm({
      title: 'Delete business',
      message: `Delete ${entity.name} (${entity.slug})? This removes the entity and everything attached to it.`,
      confirmLabel: 'Delete permanently',
    });
    if (!ok) return;
    try {
      await api.del(endpoints.entities.remove(entity.slug));
      toast.success(`${entity.name} deleted.`, 'Deleted');
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  const tableColumns = [
    columns.thumb('hero_image_url'),
    columns.primary('name', 'Business', 'slug'),
    columns.text('entity_subtype', 'Subtype'),
    columns.text('city', 'City'),
    {
      key: 'rating',
      header: 'Rating',
      align: 'right',
      render: (row) => (row.rating ? `${Number(row.rating).toFixed(1)} ★` : <span className="faint">—</span>),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <span className="row" style={{ gap: 4 }}>
          <Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Live' : 'Hidden'}</Badge>
          {row.featured && <Badge tone="primary">Featured</Badge>}
        </span>
      ),
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
          <Button size="sm" onClick={() => navigate(`/directory/entity/${encodeURIComponent(row.slug)}`)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(row)}>
            Delete
          </Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="GCR Businesses"
        description={`${entities.length.toLocaleString()} entities in the directory. Click a row to open the full editor.`}
        actions={
          <>
            <Button onClick={reload} disabled={loading}>Refresh</Button>
            <Button variant="primary" onClick={() => setCreating(true)}>Add business</Button>
          </>
        }
      />

      <Card padded={false}>
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <DataTable
            columns={tableColumns}
            rows={rows}
            loading={loading}
            error={error}
            onRetry={reload}
            rowKey="slug"
            searchPlaceholder="Search by name, slug, or city…"
            onRowClick={(row) => navigate(`/directory/entity/${encodeURIComponent(row.slug)}`)}
            initialSort={{ key: 'name', direction: 'asc' }}
            emptyTitle="No businesses"
            emptyDescription="Nothing has been imported into the GCR directory yet."
            toolbar={
              <>
                <select
                  className="ui-input ui-input--select"
                  style={{ width: 'auto' }}
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="">All types</option>
                  {subtypeOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <select
                  className="ui-input ui-input--select"
                  style={{ width: 'auto' }}
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                >
                  <option value="">Any status</option>
                  <option value="active">Live only</option>
                  <option value="inactive">Hidden only</option>
                </select>
              </>
            }
          />
        </div>
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Add business"
        description="Creates the entity row. Hours, photos, menus, and sections are added from the editor afterwards."
        size="xl"
      >
        <Notice tone="info">
          Only <code>name</code> and <code>slug</code> are required. Everything else can be filled in later.
        </Notice>
        <div style={{ height: 'var(--space-4)' }} />
        <SchemaForm
          schema={entityInfoSchema}
          initialValues={{ is_active: true, entity_type: ENTITY_TYPES[0], state: 'AL' }}
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
          submitLabel="Create business"
        />
      </Modal>

      {confirmElement}
    </>
  );
}
