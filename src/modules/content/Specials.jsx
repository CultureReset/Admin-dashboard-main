/**
 * Specials across every entity.
 *
 * Read:  GET /api/gcr/specials
 * Write: POST/PUT/DELETE /api/admin/gcr/specials[/:id]
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, PageHeader } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { Modal, useConfirm } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useEntities, EntityPicker } from '../../components/EntityPicker.jsx';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns } from '../../lib/fields.jsx';
import { specialSchema } from '../../lib/contentSchemas.js';

export default function Specials() {
  const toast = useToast();
  const navigate = useNavigate();
  const { entities } = useEntities();
  const [editing, setEditing] = useState(null);
  const [entityFilter, setEntityFilter] = useState('');
  const [confirm, confirmElement] = useConfirm();

  const { data, loading, error, reload } = useAsync(
    async () => unwrapList(await api.get(endpoints.specials.list(), { auth: false }), ['specials']),
    [],
    { initialData: [] },
  );

  const specials = data || [];
  const nameBySlug = useMemo(
    () => Object.fromEntries(entities.map((e) => [e.slug, e.name])),
    [entities],
  );

  const rows = useMemo(() => {
    const list = entityFilter ? specials.filter((s) => s.entity_slug === entityFilter) : specials;
    return list.map((special) => ({
      ...special,
      __business: nameBySlug[special.entity_slug] || special.entity_name || special.entity_slug,
    }));
  }, [specials, entityFilter, nameBySlug]);

  const save = async (values) => {
    const payload = {
      ...values,
      entity_slug: editing.entity_slug,
      entity_name: nameBySlug[editing.entity_slug] || null,
    };
    if (editing.id) await api.put(endpoints.specials.update(editing.id), payload);
    else await api.post(endpoints.specials.create(), payload);
    toast.success('Special saved.');
    setEditing(null);
    await reload();
  };

  const remove = async (row) => {
    const ok = await confirm({ title: 'Delete special', message: `Delete “${row.special_name}”?` });
    if (!ok) return;
    try {
      await api.del(endpoints.specials.remove(row.id));
      toast.success('Special deleted.', 'Deleted');
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  const tableColumns = [
    columns.thumb('image_url'),
    columns.primary('special_name', 'Special'),
    {
      key: '__business',
      header: 'Business',
      render: (row) => (
        <button
          type="button"
          className="ui-btn ui-btn--link"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/directory/entity/${encodeURIComponent(row.entity_slug)}`);
          }}
        >
          {row.__business}
        </button>
      ),
    },
    {
      key: 'discount_text',
      header: 'Discount',
      render: (row) => {
        if (row.discount_text) return row.discount_text;
        if (row.discount_value && row.discount_type === 'percent') return `${row.discount_value}% off`;
        if (row.discount_value) return `$${row.discount_value} off`;
        return <span className="faint">—</span>;
      },
    },
    {
      key: 'days',
      header: 'When',
      render: (row) =>
        [row.days || row.day_of_week, row.start_time?.slice(0, 5)].filter(Boolean).join(' · ') || (
          <span className="faint">—</span>
        ),
    },
    columns.date('end_date', 'Ends'),
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.is_active === false ? 'neutral' : 'success'}>
          {row.is_active === false ? 'Inactive' : 'Live'}
        </Badge>
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
          <Button size="sm" onClick={() => setEditing(row)}>Edit</Button>
          <Button size="sm" variant="danger" onClick={() => remove(row)}>Delete</Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Specials"
        description="Discounts and offers running across the directory."
        actions={
          <>
            <Button onClick={reload} disabled={loading}>Refresh</Button>
            <Button variant="primary" onClick={() => setEditing({ entity_slug: entityFilter || '' })}>
              Add special
            </Button>
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
            searchPlaceholder="Search specials…"
            emptyTitle="No specials"
            toolbar={
              <div style={{ minWidth: 240, flex: 1, maxWidth: 340 }}>
                <EntityPicker
                  value={entityFilter || null}
                  onChange={(slug) => setEntityFilter(slug || '')}
                  label={null}
                  placeholder="Filter by business…"
                />
              </div>
            }
          />
        </div>
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        size="lg"
        title={editing?.id ? 'Edit special' : 'Add special'}
      >
        {editing && (
          <div className="stack">
            <EntityPicker
              value={editing.entity_slug || null}
              onChange={(slug) => setEditing((prev) => ({ ...prev, entity_slug: slug }))}
              label="Business"
            />
            {editing.entity_slug ? (
              <SchemaForm
                schema={specialSchema}
                initialValues={editing}
                onSubmit={save}
                onCancel={() => setEditing(null)}
                submitLabel={editing.id ? 'Save changes' : 'Create special'}
              />
            ) : (
              <p className="muted">Choose a business before filling in the special.</p>
            )}
          </div>
        )}
      </Modal>

      {confirmElement}
    </>
  );
}
