/**
 * Per-entity Trip Swipe settings.
 *
 * GET /api/admin/tripswipe/settings           all rows
 * GET /api/admin/tripswipe/settings/:slug     one entity
 * PUT /api/admin/tripswipe/settings/:slug     save
 */

import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, LoadingBlock, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { EntityPicker, useEntities } from '../../components/EntityPicker.jsx';
import { api, unwrapList, unwrapItem } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, fields } from '../../lib/fields.jsx';

const settingsSchema = {
  groups: [
    {
      title: 'Deck',
      fields: [
        fields.bool('is_enabled', 'Show in Trip Swipe', { defaultValue: true }),
        fields.number('priority', 'Priority', {
          step: 1,
          help: 'Higher values surface earlier in the deck.',
        }),
        fields.tags('categories', 'Categories', { span: 'full' }),
      ],
    },
    {
      title: 'Card',
      fields: [
        fields.text('headline', 'Card headline', { span: 2 }),
        fields.textarea('blurb', 'Card blurb', { rows: 3 }),
        fields.image('card_image_url', 'Card image'),
      ],
    },
  ],
};

export default function TripSwipeBusinesses() {
  const toast = useToast();
  const { entities } = useEntities();
  const [editingSlug, setEditingSlug] = useState(null);
  const [editingValues, setEditingValues] = useState(null);
  const [loadingOne, setLoadingOne] = useState(false);
  const [pickSlug, setPickSlug] = useState(null);

  const { data, loading, error, reload } = useAsync(
    async () => unwrapList(await api.get(endpoints.tripswipe.settings()), ['settings']),
    [],
    { initialData: [] },
  );

  const settings = data || [];
  const nameBySlug = useMemo(
    () => Object.fromEntries(entities.map((e) => [e.slug, e.name])),
    [entities],
  );

  const rows = useMemo(
    () =>
      settings.map((row) => ({
        ...row,
        __name: nameBySlug[row.entity_slug] || row.entity_slug,
      })),
    [settings, nameBySlug],
  );

  const enabled = settings.filter((row) => row.is_enabled !== false).length;

  /** Load the individual row before editing — the list may be a summary. */
  useEffect(() => {
    if (!editingSlug) {
      setEditingValues(null);
      return;
    }
    let cancelled = false;
    setLoadingOne(true);
    api
      .get(endpoints.tripswipe.settingsForSlug(editingSlug))
      .then((payload) => {
        if (!cancelled) setEditingValues(unwrapItem(payload, ['settings', 'setting']) || {});
      })
      .catch(() => {
        // No row yet for this entity — start from an empty form.
        if (!cancelled) setEditingValues({});
      })
      .finally(() => {
        if (!cancelled) setLoadingOne(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editingSlug]);

  const save = async (values) => {
    await api.put(endpoints.tripswipe.settingsForSlug(editingSlug), values);
    toast.success(`${nameBySlug[editingSlug] || editingSlug} saved.`);
    setEditingSlug(null);
    await reload();
  };

  return (
    <>
      <PageHeader
        title="Trip Swipe businesses"
        description="Which listings appear in the swipe deck, and how their cards look."
        actions={<Button onClick={reload} disabled={loading}>Refresh</Button>}
      />

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="Configured" value={settings.length} />
        <Stat label="In the deck" value={enabled} tone="success" />
        <Stat label="Directory listings" value={entities.length} />
      </div>

      <Card title="Configure a business" subtitle="Pick any listing, whether or not it has settings yet.">
        <div className="row-wrap" style={{ alignItems: 'flex-end' }}>
          <EntityPicker value={pickSlug} onChange={setPickSlug} label="Business" />
          <Button variant="primary" disabled={!pickSlug} onClick={() => setEditingSlug(pickSlug)}>
            Edit settings
          </Button>
        </div>
      </Card>

      <div style={{ height: 'var(--space-5)' }} />

      <Card padded={false} title="Configured businesses">
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <DataTable
            columns={[
              columns.thumb('card_image_url'),
              columns.primary('__name', 'Business', 'entity_slug'),
              columns.text('headline', 'Headline'),
              columns.number('priority', 'Priority'),
              columns.tags('categories', 'Categories'),
              {
                key: 'is_enabled',
                header: 'Deck',
                render: (row) =>
                  row.is_enabled === false ? <Badge>Hidden</Badge> : <Badge tone="success">Shown</Badge>,
              },
              {
                key: '__actions',
                header: '',
                align: 'right',
                sortable: false,
                searchable: false,
                stopPropagation: true,
                render: (row) => (
                  <Button size="sm" onClick={() => setEditingSlug(row.entity_slug)}>Edit</Button>
                ),
              },
            ]}
            rows={rows}
            loading={loading}
            error={error}
            onRetry={reload}
            rowKey="entity_slug"
            searchPlaceholder="Search businesses…"
            emptyTitle="Nothing configured"
            emptyDescription="Pick a business above to add its Trip Swipe settings."
          />
        </div>
      </Card>

      <Modal
        open={Boolean(editingSlug)}
        onClose={() => setEditingSlug(null)}
        size="lg"
        title={editingSlug ? `Trip Swipe — ${nameBySlug[editingSlug] || editingSlug}` : ''}
      >
        {loadingOne && <LoadingBlock />}
        {!loadingOne && editingValues && (
          <SchemaForm
            schema={settingsSchema}
            initialValues={editingValues}
            onSubmit={save}
            onCancel={() => setEditingSlug(null)}
            submitLabel="Save settings"
          />
        )}
      </Modal>
    </>
  );
}
