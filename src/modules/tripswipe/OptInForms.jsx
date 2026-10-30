/**
 * Opt-In Forms — keyword → magic-link consent + configurable fields.
 *
 * Admin CRUD against /api/admin/optin-forms (mirrors SwipeQuestions patterns).
 * Field definitions are stored as a JSON array on each form; this editor
 * builds them with add/edit/remove/reorder — no hardcoded field keys.
 */

import { useCallback, useMemo, useState } from 'react';
import { Button, Card, PageHeader } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Modal, useConfirm } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useResource } from '../../hooks/useResource.js';
import { optinFormsResource } from '../../api/resources.js';
import { columns } from '../../lib/fields.jsx';
import { endpoints as ep } from '../../api/endpoints.js';
import { api } from '../../api/client.js';

const INPUT_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'tel', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'date', label: 'Date' },
  { value: 'daterange', label: 'Date range' },
  { value: 'radio', label: 'Pick one (radio)' },
  { value: 'select', label: 'Pick one (select)' },
  { value: 'multi', label: 'Pick several' },
  { value: 'tags', label: 'Tags' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'number', label: 'Number' },
];

const emptyField = () => ({
  key: '',
  label: '',
  subtitle: '',
  input_type: 'text',
  options: [],
  placeholder: '',
  required: false,
  sort_order: 100,
});

const emptyForm = () => ({
  keyword: '',
  business_slug: '',
  consent_text: '',
  magic_link_base_url: 'https://gulfcoastradar.com/optin',
  active: true,
  sort_order: 100,
  fields: [],
});

function FieldBuilder({ fields, onChange }) {
  const update = (idx, patch) => {
    const next = fields.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    onChange(next);
  };
  const remove = (idx) => onChange(fields.filter((_, i) => i !== idx));
  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next.map((f, i) => ({ ...f, sort_order: (i + 1) * 10 })));
  };
  const add = () => onChange([...fields, { ...emptyField(), sort_order: (fields.length + 1) * 10 }]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Fields</strong>
        <Button type="button" onClick={add}>Add field</Button>
      </div>
      {fields.length === 0 && (
        <p style={{ opacity: 0.7, margin: 0 }}>No fields yet. Add the questions shown on the opt-in page.</p>
      )}
      {fields.map((f, idx) => (
        <Card key={idx}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 12 }}>
            <label>
              Key
              <input value={f.key} onChange={(e) => update(idx, { key: e.target.value.trim() })} placeholder="e.g. name" required />
            </label>
            <label>
              Input type
              <select value={f.input_type} onChange={(e) => update(idx, { input_type: e.target.value })}>
                {INPUT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Label
              <input value={f.label} onChange={(e) => update(idx, { label: e.target.value })} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Subtitle
              <input value={f.subtitle || ''} onChange={(e) => update(idx, { subtitle: e.target.value })} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Placeholder
              <input value={f.placeholder || ''} onChange={(e) => update(idx, { placeholder: e.target.value })} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Options (comma-separated; for radio/select/multi/tags)
              <input
                value={Array.isArray(f.options) ? f.options.map((o) => (typeof o === 'string' ? o : o?.value || o?.label || '')).join(', ') : ''}
                onChange={(e) => update(idx, {
                  options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean).map((v) => ({ value: v, label: v })),
                })}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={!!f.required} onChange={(e) => update(idx, { required: e.target.checked })} />
              Required
            </label>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <Button type="button" onClick={() => move(idx, -1)} disabled={idx === 0}>↑</Button>
              <Button type="button" onClick={() => move(idx, 1)} disabled={idx === fields.length - 1}>↓</Button>
              <Button type="button" onClick={() => remove(idx)}>Remove</Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function OptInForms() {
  const toast = useToast();
  const [confirm, confirmElement] = useConfirm();
  const { rows, loading, error, reload, save, remove } = useResource(optinFormsResource, {
    labelFor: (row) => row.keyword,
  });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);

  const openCreate = () => setEditing(emptyForm());
  const openEdit = useCallback((row) => setEditing({
    ...emptyForm(),
    ...row,
    business_slug: row.business_slug || '',
    fields: Array.isArray(row.fields) ? row.fields : [],
  }), []);
  const close = () => setEditing(null);

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!editing?.keyword?.trim()) {
      toast.error('Keyword is required');
      return;
    }
    for (const f of editing.fields || []) {
      if (!f.key || !f.label) {
        toast.error('Every field needs a key and label');
        return;
      }
    }
    setSaving(true);
    try {
      const body = {
        ...editing,
        keyword: editing.keyword.trim().toUpperCase(),
        business_slug: editing.business_slug?.trim() || null,
        fields: (editing.fields || []).map((f, i) => ({ ...f, sort_order: (i + 1) * 10 })),
      };
      await save(body);
      toast.success(editing.id ? 'Form updated' : 'Form created');
      close();
      reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (row) => {
    const ok = await confirm({
      title: 'Delete opt-in form',
      message: `Delete keyword ${row.keyword}? Existing tokens for this form stop working.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await remove(row.id);
      toast.success('Deleted');
      reload();
    } catch (err) {
      toast.error(err);
    }
  }, [confirm, remove, reload, toast]);

  const normalizeOrder = async () => {
    setReordering(true);
    const ordered = [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    try {
      await api.put(ep.optinForms.reorder(), { ids: ordered.map((r) => r.id) });
      toast.success('Order saved');
      reload();
    } catch {
      try {
        let changed = 0;
        for (const [index, row] of ordered.entries()) {
          const next = (index + 1) * 10;
          if (row.sort_order === next) continue;
          await optinFormsResource.update(row.id, { sort_order: next });
          changed += 1;
        }
        toast.success(changed ? `Renumbered ${changed} forms.` : 'Order was already sequential.');
        reload();
      } catch (err2) {
        toast.error(err2);
      }
    } finally {
      setReordering(false);
    }
  };

  const tableColumns = useMemo(() => [
    columns.number('sort_order', '#'),
    columns.primary('keyword', 'Keyword', 'business_slug'),
    columns.text('business_slug', 'Business'),
    {
      key: 'fields',
      header: 'Fields',
      sortable: false,
      render: (row) => (Array.isArray(row.fields) ? String(row.fields.length) : '0'),
    },
    columns.bool('active', 'Active'),
    {
      key: '__actions',
      header: '',
      align: 'right',
      width: '1%',
      sortable: false,
      searchable: false,
      stopPropagation: true,
      render: (row) => (
        <span className="ui-cell-actions">
          <Button size="sm" onClick={() => openEdit(row)}>Edit</Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(row)}>Delete</Button>
        </span>
      ),
    },
  ], [openEdit, handleDelete]);

  return (
    <>
      <PageHeader
        title="Opt-In Forms"
        description="Keyword-driven magic-link forms. A tourist texts the keyword, gets a one-time link, fills consent + fields, and is linked by phone."
        actions={(
          <>
            <Button onClick={reload} disabled={loading}>Refresh</Button>
            <Button onClick={normalizeOrder} loading={reordering}>Renumber order</Button>
            <Button variant="primary" onClick={openCreate}>Add form</Button>
          </>
        )}
      />
      <Card padded={false}>
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <DataTable
            rows={rows}
            loading={loading}
            error={error}
            onRetry={reload}
            columns={tableColumns}
            rowKey="id"
            initialSort={{ key: 'sort_order', direction: 'asc' }}
            searchPlaceholder="Search keywords…"
            emptyTitle="No opt-in forms"
            emptyDescription="Create a form with a keyword like BEACH and the fields to collect."
            emptyAction={<Button variant="primary" onClick={openCreate}>Add form</Button>}
          />
        </div>
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={close}
        title={editing?.id ? `Edit ${editing.keyword}` : 'New opt-in form'}
        size="lg"
        footer={(
          <>
            <Button onClick={close}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} variant="primary">Save</Button>
          </>
        )}
      >
        {editing && (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label>
                Keyword
                <input
                  value={editing.keyword}
                  onChange={(e) => setEditing({ ...editing, keyword: e.target.value.toUpperCase() })}
                  placeholder="BEACH"
                  required
                />
              </label>
              <label>
                Business slug (optional)
                <input
                  value={editing.business_slug}
                  onChange={(e) => setEditing({ ...editing, business_slug: e.target.value })}
                  placeholder="Leave blank for platform-wide"
                />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Magic link base URL
                <input
                  value={editing.magic_link_base_url}
                  onChange={(e) => setEditing({ ...editing, magic_link_base_url: e.target.value })}
                  placeholder="https://gulfcoastradar.com/optin"
                />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Consent text
                <textarea
                  rows={4}
                  value={editing.consent_text}
                  onChange={(e) => setEditing({ ...editing, consent_text: e.target.value })}
                  placeholder="Shown above the form. Tourist must accept to submit."
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={!!editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                Active
              </label>
              <label>
                Sort order
                <input
                  type="number"
                  value={editing.sort_order ?? 100}
                  onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                />
              </label>
            </div>
            <FieldBuilder
              fields={editing.fields || []}
              onChange={(fields) => setEditing({ ...editing, fields })}
            />
          </form>
        )}
      </Modal>
      {confirmElement}
    </>
  );
}
