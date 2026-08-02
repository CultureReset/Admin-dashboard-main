/**
 * Entity Editor → Content.
 *
 * Menus, drinks, happy hour, events, and specials for this entity.
 * Reads through the public entity model, writes through the admin routes.
 */

import { useState } from 'react';
import { Button, Card, EmptyState, LoadingBlock, ErrorState, Badge } from '../../../ui/primitives.jsx';
import { TabBar } from '../../../ui/Tabs.jsx';
import { SchemaForm } from '../../../ui/SchemaForm.jsx';
import { Modal, useConfirm } from '../../../ui/Modal.jsx';
import { useToast } from '../../../ui/Toast.jsx';
import { SectionedItemsEditor } from '../../../components/SectionedItemsEditor.jsx';
import { useEntityFull } from '../useEntityFull.js';
import { api } from '../../../api/client.js';
import { endpoints } from '../../../api/endpoints.js';
import {
  menuItemSchema,
  drinkItemSchema,
  happyHourItemSchema,
  menuSectionExtraFields,
  eventSchema,
  specialSchema,
} from '../../../lib/contentSchemas.js';
import { formatDate, formatMoney } from '../../../lib/fields.jsx';

const SUB_TABS = [
  { id: 'menu', label: 'Menu' },
  { id: 'drinks', label: 'Drinks' },
  { id: 'happy-hour', label: 'Happy hour' },
  { id: 'events', label: 'Events' },
  { id: 'specials', label: 'Specials' },
];

export default function ContentTab({ slug, entityName }) {
  const [active, setActive] = useState('menu');
  const { data, loading, error, reload } = useEntityFull(slug);

  const counts = {
    menu: (data?.menu_sections || []).reduce((n, s) => n + (s.items?.length || 0), 0),
    drinks: (data?.drink_sections || []).reduce((n, s) => n + (s.items?.length || 0), 0),
    'happy-hour': (data?.happy_hour_sections || []).reduce((n, s) => n + (s.items?.length || 0), 0),
    events: (data?.events || []).length,
    specials: (data?.specials || []).length,
  };

  return (
    <div className="stack">
      <TabBar
        tabs={SUB_TABS.map((t) => ({ id: t.id, label: t.label, badge: counts[t.id] ?? 0 }))}
        activeId={active}
        onChange={setActive}
      />

      {active === 'menu' && (
        <SectionedItemsEditor
          title="Menu"
          subtitle="Food menu sections and items."
          slug={slug}
          sections={data?.menu_sections || []}
          loading={loading}
          error={error}
          reload={reload}
          sectionCreatePath={endpoints.menu.sections}
          sectionItemPath={endpoints.menu.section}
          itemCreatePath={endpoints.menu.items}
          itemItemPath={endpoints.menu.item}
          itemSchema={menuItemSchema}
          itemNoun="item"
          extraSectionFields={menuSectionExtraFields}
        />
      )}

      {active === 'drinks' && (
        <SectionedItemsEditor
          title="Drinks"
          subtitle="Drink list sections and items."
          slug={slug}
          sections={data?.drink_sections || []}
          loading={loading}
          error={error}
          reload={reload}
          sectionCreatePath={endpoints.drinks.sections}
          sectionItemPath={endpoints.menu.section}
          itemCreatePath={endpoints.drinks.items}
          itemItemPath={endpoints.drinks.item}
          itemSchema={drinkItemSchema}
          itemNoun="drink"
        />
      )}

      {active === 'happy-hour' && (
        <SectionedItemsEditor
          title="Happy hour"
          subtitle="Discounted items. The schedule itself is set on the Hours tab."
          slug={slug}
          sections={data?.happy_hour_sections || []}
          loading={loading}
          error={error}
          reload={reload}
          sectionCreatePath={endpoints.happyHour.sections}
          sectionItemPath={endpoints.menu.section}
          itemCreatePath={endpoints.happyHour.items}
          itemItemPath={endpoints.happyHour.item}
          itemSchema={happyHourItemSchema}
          itemNoun="item"
        />
      )}

      {active === 'events' && (
        <EntityRowList
          title="Events"
          noun="event"
          slug={slug}
          entityName={entityName}
          rows={data?.events || []}
          loading={loading}
          error={error}
          reload={reload}
          schema={eventSchema}
          nameField="event_name"
          createPath={endpoints.events.create}
          itemPath={endpoints.events.update}
          describe={(row) => [
            row.event_date ? formatDate(row.event_date) : row.day_of_week,
            row.start_time?.slice(0, 5),
            row.artist_name,
            row.cover_charge ? `${formatMoney(row.cover_charge)} cover` : null,
          ]}
        />
      )}

      {active === 'specials' && (
        <EntityRowList
          title="Specials"
          noun="special"
          slug={slug}
          entityName={entityName}
          rows={data?.specials || []}
          loading={loading}
          error={error}
          reload={reload}
          schema={specialSchema}
          nameField="special_name"
          createPath={endpoints.specials.create}
          itemPath={endpoints.specials.update}
          describe={(row) => [
            row.discount_text,
            row.days || row.day_of_week,
            row.start_time?.slice(0, 5),
          ]}
        />
      )}
    </div>
  );
}

/**
 * Flat list of rows attached to an entity (events, specials). Both write
 * routes take `entity_slug` in the body rather than the path, so the slug is
 * injected on save instead of being a form field the admin could mistype.
 */
function EntityRowList({
  title,
  noun,
  slug,
  entityName,
  rows,
  loading,
  error,
  reload,
  schema,
  nameField,
  createPath,
  itemPath,
  describe,
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [confirm, confirmElement] = useConfirm();

  const save = async (values) => {
    const payload = { ...values, entity_slug: slug, entity_name: entityName || null };
    if (editing?.id) await api.put(itemPath(editing.id), payload);
    else await api.post(createPath(), payload);
    toast.success(`${title.slice(0, -1)} saved.`);
    setEditing(null);
    await reload();
  };

  const remove = async (row) => {
    const ok = await confirm({
      title: `Delete ${noun}`,
      message: `Delete “${row[nameField]}”?`,
    });
    if (!ok) return;
    try {
      await api.del(itemPath(row.id));
      toast.success(`${noun} deleted.`, 'Deleted');
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <>
      <Card
        title={title}
        subtitle={`${noun}s attached to this business`}
        actions={
          <>
            <Button size="sm" onClick={reload} disabled={loading}>Refresh</Button>
            <Button size="sm" variant="primary" onClick={() => setEditing({})}>Add {noun}</Button>
          </>
        }
      >
        {error && <ErrorState error={error} onRetry={reload} />}
        {loading && <LoadingBlock />}
        {!loading && !error && rows.length === 0 && (
          <EmptyState
            icon="🗓️"
            title={`No ${noun}s`}
            description={`Nothing scheduled for this business yet.`}
            action={<Button variant="primary" onClick={() => setEditing({})}>Add {noun}</Button>}
          />
        )}
        {!loading && !error && rows.length > 0 && (
          <ul className="sec-editor__items">
            {rows.map((row) => (
              <li className="sec-editor__item" key={row.id}>
                {row.image_url && <img src={row.image_url} alt="" className="sec-editor__thumb" />}
                <div className="sec-editor__itembody">
                  <div className="sec-editor__itemname">
                    {row[nameField]}
                    {row.is_active === false && <Badge tone="warning">Inactive</Badge>}
                    {row.recurring && <Badge tone="info">Recurring</Badge>}
                  </div>
                  <div className="sec-editor__itemdesc">
                    {describe(row).filter(Boolean).join(' · ') || row.description}
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <Button size="sm" onClick={() => setEditing(row)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => remove(row)}>Delete</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        size="lg"
        title={editing?.id ? `Edit ${noun}` : `Add ${noun}`}
      >
        {editing && (
          <SchemaForm
            schema={schema}
            initialValues={editing}
            onSubmit={save}
            onCancel={() => setEditing(null)}
            submitLabel={editing.id ? 'Save changes' : `Add ${noun}`}
          />
        )}
      </Modal>

      {confirmElement}
    </>
  );
}
