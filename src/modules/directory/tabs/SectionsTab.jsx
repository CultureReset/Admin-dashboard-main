/**
 * Entity Editor → Sections.
 *
 * entity_sections holds the flexible content blocks used by non-restaurant
 * entity types (tour types, what's included, amenities, room types, …), each
 * with its own items.
 *
 * The API models this as a whole-collection replace:
 *   GET    /api/admin/entities/:slug/sections
 *   POST   /api/admin/entities/:slug/sections   { sections: [...] }  (replaces)
 *   DELETE /api/admin/entities/:slug/sections                        (clears)
 *
 * Note the path has no /gcr segment — these routes are mounted directly under
 * /api/admin, unlike the rest of the entity routes.
 */

import { useEffect, useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, Notice } from '../../../ui/primitives.jsx';
import { SchemaForm } from '../../../ui/SchemaForm.jsx';
import { Modal, useConfirm } from '../../../ui/Modal.jsx';
import { useToast } from '../../../ui/Toast.jsx';
import { api, unwrapList } from '../../../api/client.js';
import { endpoints } from '../../../api/endpoints.js';
import { fields } from '../../../lib/fields.jsx';

/** section_type values the public renderer understands, per schema.sql. */
const SECTION_TYPES = [
  'tour_types',
  'whats_included',
  'highlights',
  'policies',
  'service_packages',
  'what_we_do',
  'faqs',
  'room_types',
  'amenities',
];

const sectionSchema = [
  fields.text('section_name', 'Section name', { required: true, span: 2 }),
  fields.select('section_type', 'Section type', SECTION_TYPES, {
    required: true,
    help: 'Controls how the public site renders this block.',
  }),
  fields.sortOrder(),
];

const itemSchema = [
  fields.text('item_name', 'Item name', { required: true, span: 2 }),
  fields.textarea('description', 'Description', { rows: 3 }),
  fields.money('price_from', 'Price from'),
  fields.image('image_url', 'Image URL'),
];

export default function SectionsTab({ slug }) {
  const toast = useToast();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [confirm, confirmElement] = useConfirm();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.get(endpoints.sections.list(slug));
      setSections(unwrapList(payload, ['sections']));
    } catch (err) {
      setError(err);
      setSections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  /**
   * Every edit is a full replace of the collection, because that is the only
   * write the API offers. The local list is the source of truth while editing
   * and is pushed in one request.
   */
  const persist = async (next) => {
    setSaving(true);
    try {
      await api.post(endpoints.sections.replace(slug), { sections: next });
      toast.success('Sections saved.');
      await load();
    } catch (err) {
      toast.error(err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const saveSection = async (values) => {
    const next = editingSection?.__index != null
      ? sections.map((s, i) => (i === editingSection.__index ? { ...s, ...values } : s))
      : [...sections, { ...values, items: [] }];
    await persist(next);
    setEditingSection(null);
  };

  const deleteSection = async (index) => {
    const ok = await confirm({
      title: 'Delete section',
      message: `Delete “${sections[index].section_name}” and its items?`,
    });
    if (!ok) return;
    await persist(sections.filter((_, i) => i !== index)).catch(() => {});
  };

  const saveItem = async (values) => {
    const { sectionIndex, itemIndex } = editingItem;
    const next = sections.map((section, i) => {
      if (i !== sectionIndex) return section;
      const items = section.items || [];
      return {
        ...section,
        items:
          itemIndex != null
            ? items.map((item, j) => (j === itemIndex ? { ...item, ...values } : item))
            : [...items, values],
      };
    });
    await persist(next);
    setEditingItem(null);
  };

  const deleteItem = async (sectionIndex, itemIndex) => {
    const ok = await confirm({
      title: 'Delete item',
      message: `Delete “${sections[sectionIndex].items[itemIndex].item_name}”?`,
    });
    if (!ok) return;
    const next = sections.map((section, i) =>
      i === sectionIndex
        ? { ...section, items: (section.items || []).filter((_, j) => j !== itemIndex) }
        : section,
    );
    await persist(next).catch(() => {});
  };

  const clearAll = async () => {
    const ok = await confirm({
      title: 'Clear all sections',
      message: 'Remove every section and item from this entity?',
      confirmLabel: 'Clear everything',
    });
    if (!ok) return;
    try {
      await api.del(endpoints.sections.clear(slug));
      toast.success('All sections cleared.', 'Deleted');
      await load();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <>
      <Card
        title="Content sections"
        subtitle="Flexible blocks for activities, services, and stays."
        actions={
          <>
            <Button size="sm" onClick={load} disabled={loading}>Refresh</Button>
            {sections.length > 0 && (
              <Button size="sm" variant="danger" onClick={clearAll}>Clear all</Button>
            )}
            <Button size="sm" variant="primary" onClick={() => setEditingSection({})}>
              Add section
            </Button>
          </>
        }
      >
        <Notice tone="info">
          The API replaces the whole collection on save, so each change here re-sends every section.
        </Notice>
        <div style={{ height: 'var(--space-4)' }} />

        {error && <ErrorState error={error} onRetry={load} />}
        {loading && <LoadingBlock />}

        {!loading && !error && sections.length === 0 && (
          <EmptyState
            icon="🧱"
            title="No sections"
            description="Restaurants normally use the Content tab instead. Sections are for tours, services, and stays."
            action={<Button variant="primary" onClick={() => setEditingSection({})}>Add section</Button>}
          />
        )}

        {!loading && !error && sections.length > 0 && (
          <div className="sec-editor">
            {sections.map((section, sectionIndex) => (
              <div className="sec-editor__section" key={section.id || `${section.section_name}-${sectionIndex}`}>
                <header className="sec-editor__head">
                  <div className="sec-editor__title">
                    {section.section_name}
                    <Badge tone="info">{section.section_type}</Badge>
                    <Badge>{(section.items || []).length}</Badge>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <Button
                      size="sm"
                      onClick={() => setEditingItem({ sectionIndex, itemIndex: null, item: {} })}
                    >
                      Add item
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setEditingSection({ ...section, __index: sectionIndex })}
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => deleteSection(sectionIndex)}>
                      Delete
                    </Button>
                  </div>
                </header>

                {(section.items || []).length === 0 ? (
                  <p className="sec-editor__empty muted">No items in this section.</p>
                ) : (
                  <ul className="sec-editor__items">
                    {(section.items || []).map((item, itemIndex) => (
                      <li className="sec-editor__item" key={item.id || `${item.item_name}-${itemIndex}`}>
                        {item.image_url && <img src={item.image_url} alt="" className="sec-editor__thumb" />}
                        <div className="sec-editor__itembody">
                          <div className="sec-editor__itemname">{item.item_name}</div>
                          {item.description && (
                            <div className="sec-editor__itemdesc">{item.description}</div>
                          )}
                        </div>
                        <div className="row" style={{ gap: 6 }}>
                          <Button
                            size="sm"
                            onClick={() => setEditingItem({ sectionIndex, itemIndex, item })}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => deleteItem(sectionIndex, itemIndex)}
                          >
                            Delete
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(editingSection)}
        onClose={() => setEditingSection(null)}
        title={editingSection?.__index != null ? 'Edit section' : 'Add section'}
      >
        {editingSection && (
          <SchemaForm
            schema={sectionSchema}
            initialValues={editingSection}
            disabled={saving}
            onSubmit={saveSection}
            onCancel={() => setEditingSection(null)}
            submitLabel="Save"
          />
        )}
      </Modal>

      <Modal
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title={editingItem?.itemIndex != null ? 'Edit item' : 'Add item'}
      >
        {editingItem && (
          <SchemaForm
            schema={itemSchema}
            initialValues={editingItem.item}
            disabled={saving}
            onSubmit={saveItem}
            onCancel={() => setEditingItem(null)}
            submitLabel="Save"
          />
        )}
      </Modal>

      {confirmElement}
    </>
  );
}
