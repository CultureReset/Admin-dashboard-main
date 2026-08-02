/**
 * Sections-with-items editor.
 *
 * Menus, drinks, and happy hour are the same structure — named sections, each
 * holding priced items — served by three parallel sets of routes. One
 * component covers all three; the caller supplies the endpoints and the field
 * schema, so a fourth list of this shape needs no new component.
 */

import { useState } from 'react';
import { Badge, Button, Card, EmptyState, LoadingBlock, ErrorState } from '../ui/primitives.jsx';
import { SchemaForm } from '../ui/SchemaForm.jsx';
import { Modal, useConfirm } from '../ui/Modal.jsx';
import { useToast } from '../ui/Toast.jsx';
import { api } from '../api/client.js';
import { fields, formatMoney } from '../lib/fields.jsx';
import './SectionedItemsEditor.css';

const sectionSchema = [
  fields.text('section_name', 'Section name', { required: true, span: 'full' }),
  fields.sortOrder(),
];

export function SectionedItemsEditor({
  title,
  subtitle,
  slug,
  /** Nested sections from the public read model: [{ id, section_name, items }] */
  sections = [],
  loading,
  error,
  reload,
  /** Path builders. */
  sectionCreatePath,
  sectionItemPath,
  itemCreatePath,
  itemItemPath,
  /** Field schema for an item in this list. */
  itemSchema,
  itemNoun = 'item',
  /** Extra fields on the section form (e.g. menu section day/time windows). */
  extraSectionFields = [],
}) {
  const toast = useToast();
  const [editingSection, setEditingSection] = useState(null);
  const [editingItem, setEditingItem] = useState(null); // { sectionId, item }
  const [confirm, confirmElement] = useConfirm();

  const fullSectionSchema = [...sectionSchema, ...extraSectionFields];

  const saveSection = async (values) => {
    if (editingSection?.id) {
      await api.put(sectionItemPath(editingSection.id), values);
    } else {
      await api.post(sectionCreatePath(slug), values);
    }
    toast.success('Section saved.');
    setEditingSection(null);
    await reload();
  };

  const deleteSection = async (section) => {
    const ok = await confirm({
      title: 'Delete section',
      message: `Delete “${section.section_name}” and every ${itemNoun} inside it?`,
    });
    if (!ok) return;
    try {
      await api.del(sectionItemPath(section.id));
      toast.success('Section deleted.', 'Deleted');
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  const saveItem = async (values) => {
    const payload = { ...values, section_id: editingItem.sectionId };
    if (editingItem.item?.id) {
      await api.put(itemItemPath(editingItem.item.id), payload);
    } else {
      await api.post(itemCreatePath(slug), payload);
    }
    toast.success(`${itemNoun[0].toUpperCase()}${itemNoun.slice(1)} saved.`);
    setEditingItem(null);
    await reload();
  };

  const deleteItem = async (item) => {
    const ok = await confirm({
      title: `Delete ${itemNoun}`,
      message: `Delete “${item.item_name}”?`,
    });
    if (!ok) return;
    try {
      await api.del(itemItemPath(item.id));
      toast.success(`${itemNoun} deleted.`, 'Deleted');
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <>
      <Card
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <Button size="sm" onClick={reload} disabled={loading}>Refresh</Button>
            <Button size="sm" variant="primary" onClick={() => setEditingSection({})}>
              Add section
            </Button>
          </>
        }
      >
        {error && <ErrorState error={error} onRetry={reload} />}
        {loading && <LoadingBlock />}

        {!loading && !error && sections.length === 0 && (
          <EmptyState
            icon="📋"
            title={`No ${title.toLowerCase()} yet`}
            description={`Create a section first, then add ${itemNoun}s to it.`}
            action={
              <Button variant="primary" onClick={() => setEditingSection({})}>
                Add section
              </Button>
            }
          />
        )}

        {!loading && !error && sections.length > 0 && (
          <div className="sec-editor">
            {sections.map((section) => (
              <div className="sec-editor__section" key={section.id}>
                <header className="sec-editor__head">
                  <div className="sec-editor__title">
                    {section.section_name}
                    <Badge>{(section.items || []).length}</Badge>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <Button size="sm" onClick={() => setEditingItem({ sectionId: section.id, item: null })}>
                      Add {itemNoun}
                    </Button>
                    <Button size="sm" onClick={() => setEditingSection(section)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => deleteSection(section)}>Delete</Button>
                  </div>
                </header>

                {(section.items || []).length === 0 ? (
                  <p className="sec-editor__empty muted">No {itemNoun}s in this section.</p>
                ) : (
                  <ul className="sec-editor__items">
                    {(section.items || []).map((item) => (
                      <li className="sec-editor__item" key={item.id}>
                        {item.image_url && <img src={item.image_url} alt="" className="sec-editor__thumb" />}
                        <div className="sec-editor__itembody">
                          <div className="sec-editor__itemname">
                            {item.item_name}
                            {item.is_featured && <Badge tone="primary">Featured</Badge>}
                            {item.is_available === false && <Badge tone="warning">Unavailable</Badge>}
                          </div>
                          {item.description && (
                            <div className="sec-editor__itemdesc">{item.description}</div>
                          )}
                        </div>
                        <div className="sec-editor__price">
                          {item.has_market_price ? 'Market' : formatMoney(item.price) || '—'}
                          {item.original_price ? (
                            <span className="sec-editor__was">{formatMoney(item.original_price)}</span>
                          ) : null}
                        </div>
                        <div className="row" style={{ gap: 6 }}>
                          <Button
                            size="sm"
                            onClick={() => setEditingItem({ sectionId: section.id, item })}
                          >
                            Edit
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => deleteItem(item)}>
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
        title={editingSection?.id ? 'Edit section' : 'Add section'}
      >
        {editingSection && (
          <SchemaForm
            schema={fullSectionSchema}
            initialValues={editingSection}
            onSubmit={saveSection}
            onCancel={() => setEditingSection(null)}
            submitLabel={editingSection.id ? 'Save section' : 'Create section'}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        size="lg"
        title={editingItem?.item ? `Edit ${itemNoun}` : `Add ${itemNoun}`}
      >
        {editingItem && (
          <SchemaForm
            schema={itemSchema}
            initialValues={editingItem.item || {}}
            onSubmit={saveItem}
            onCancel={() => setEditingItem(null)}
            submitLabel={editingItem.item ? 'Save changes' : `Add ${itemNoun}`}
          />
        )}
      </Modal>

      {confirmElement}
    </>
  );
}

export default SectionedItemsEditor;
