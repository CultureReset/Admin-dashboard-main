/**
 * Events across every entity.
 *
 * Read:  GET /api/gcr/events            (admin.js has no list route)
 * Write: POST/PUT/DELETE /api/admin/gcr/events[/:id]
 *
 * `entity_slug` is a required part of every event row, so it is chosen with
 * the shared entity picker rather than typed.
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
import { columns, formatMoney } from '../../lib/fields.jsx';
import { eventSchema } from '../../lib/contentSchemas.js';

export default function Events() {
  const toast = useToast();
  const navigate = useNavigate();
  const { entities } = useEntities();
  const [editing, setEditing] = useState(null);
  const [entityFilter, setEntityFilter] = useState('');
  const [confirm, confirmElement] = useConfirm();
  const [backfilling, setBackfilling] = useState(false);

  const { data, loading, error, reload } = useAsync(
    async () => unwrapList(await api.get(endpoints.events.list(), { auth: false }), ['events']),
    [],
    { initialData: [] },
  );

  const events = data || [];

  // Names are looked up from the entity list rather than trusting the
  // denormalised entity_name column, which can lag a rename.
  const nameBySlug = useMemo(
    () => Object.fromEntries(entities.map((e) => [e.slug, e.name])),
    [entities],
  );

  const rows = useMemo(() => {
    const list = entityFilter ? events.filter((e) => e.entity_slug === entityFilter) : events;
    return list.map((event) => ({
      ...event,
      __business: nameBySlug[event.entity_slug] || event.entity_name || event.entity_slug,
    }));
  }, [events, entityFilter, nameBySlug]);

  const save = async (values) => {
    const payload = {
      ...values,
      entity_slug: editing.entity_slug,
      entity_name: nameBySlug[editing.entity_slug] || null,
    };
    if (editing.id) await api.put(endpoints.events.update(editing.id), payload);
    else await api.post(endpoints.events.create(), payload);
    toast.success('Event saved.');
    setEditing(null);
    await reload();
  };

  const remove = async (row) => {
    const ok = await confirm({ title: 'Delete event', message: `Delete “${row.event_name}”?` });
    if (!ok) return;
    try {
      await api.del(endpoints.events.remove(row.id));
      toast.success('Event deleted.', 'Deleted');
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  const backfillTypes = async () => {
    setBackfilling(true);
    try {
      const result = await api.post(endpoints.events.backfillTypes());
      toast.success(
        `Scanned ${result?.total ?? 0} events, updated ${result?.updated ?? 0}.`,
        'Backfill complete',
      );
      await reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBackfilling(false);
    }
  };

  const tableColumns = [
    columns.thumb('image_url'),
    columns.primary('event_name', 'Event'),
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
    columns.date('event_date', 'Date'),
    {
      key: 'start_time',
      header: 'Time',
      render: (row) =>
        row.start_time
          ? `${row.start_time.slice(0, 5)}${row.end_time ? `–${row.end_time.slice(0, 5)}` : ''}`
          : row.day_of_week || <span className="faint">—</span>,
    },
    columns.text('artist_name', 'Artist'),
    {
      key: 'cover_charge',
      header: 'Cover',
      align: 'right',
      render: (row) => formatMoney(row.cover_charge) || <span className="faint">Free</span>,
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <span className="row" style={{ gap: 4 }}>
          <Badge tone={row.is_active === false ? 'neutral' : 'success'}>
            {row.is_active === false ? 'Inactive' : 'Live'}
          </Badge>
          {row.recurring && <Badge tone="info">Weekly</Badge>}
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
          <Button size="sm" onClick={() => setEditing(row)}>Edit</Button>
          <Button size="sm" variant="danger" onClick={() => remove(row)}>Delete</Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Events"
        description="Every event across the directory. Filter by business or add one to any listing."
        actions={
          <>
            <Button onClick={backfillTypes} loading={backfilling} title="Infer event_type for events missing one">
              Backfill types
            </Button>
            <Button onClick={reload} disabled={loading}>Refresh</Button>
            <Button variant="primary" onClick={() => setEditing({ entity_slug: entityFilter || '' })}>
              Add event
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
            searchPlaceholder="Search events…"
            emptyTitle="No events"
            emptyDescription="Nothing scheduled across the directory."
            initialSort={{ key: 'event_date', direction: 'asc' }}
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
        title={editing?.id ? 'Edit event' : 'Add event'}
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
                schema={eventSchema}
                initialValues={editing}
                onSubmit={save}
                onCancel={() => setEditing(null)}
                submitLabel={editing.id ? 'Save changes' : 'Create event'}
              />
            ) : (
              <p className="muted">Choose a business before filling in the event.</p>
            )}
          </div>
        )}
      </Modal>

      {confirmElement}
    </>
  );
}
