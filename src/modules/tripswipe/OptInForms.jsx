/**
 * Opt-In Campaigns — keyword → magic-link consent + configurable fields.
 *
 * Admin CRUD against /api/admin/optin-campaigns (gcr-api-clean), matching
 * tables optin_campaigns + optin_campaign_fields from API PR #64.
 *
 * PR #64 only ships tourist routes (GET /optin-config, GET /sms-cta,
 * POST /optin-submit). Admin list/create/update/delete are NOT in that PR —
 * this editor is ready for them and surfaces 404 via the shared API client
 * until gcr-api-clean adds:
 *   GET/POST /api/admin/optin-campaigns
 *   GET/PUT/DELETE /api/admin/optin-campaigns/:id
 * with nested `fields` upserted into optin_campaign_fields.
 *
 * All reads/writes go through src/api/client.js — never Supabase directly.
 */

import { useCallback, useMemo, useState } from 'react';
import { Button, Card, PageHeader } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Modal, useConfirm } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useResource } from '../../hooks/useResource.js';
import { optinCampaignsResource } from '../../api/resources.js';
import { columns } from '../../lib/fields.jsx';

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
  { value: 'number', label: 'Number' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'consent', label: 'Consent tick' },
];

const emptyField = () => ({
  field_key: '',
  label: '',
  help_text: '',
  input_type: 'text',
  options: [],
  placeholder: '',
  required: false,
  maps_to: '',
  sort_order: 100,
});

const emptyCampaign = () => ({
  keyword: '',
  entity_slug: '',
  sms_number: '+12562849584',
  sms_body: '',
  reply_template: 'Welcome! Tap to finish signup: {{url}} (expires in 30 min). Reply STOP to opt out.',
  page_title: 'Finish signing up',
  page_subtitle: '',
  submit_label: 'Continue',
  cta_label: '',
  consent_scope: 'universal',
  terms_version: '2026-10-21.v1',
  hero_image_url: '',
  active: true,
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
              Field key
              <input
                value={f.field_key}
                onChange={(e) => update(idx, { field_key: e.target.value.trim() })}
                placeholder="e.g. name"
                required
              />
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
              Help text
              <input value={f.help_text || ''} onChange={(e) => update(idx, { help_text: e.target.value })} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Placeholder
              <input value={f.placeholder || ''} onChange={(e) => update(idx, { placeholder: e.target.value })} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Maps to (tourist_profiles.col | answers.key | consent)
              <input
                value={f.maps_to || ''}
                onChange={(e) => update(idx, { maps_to: e.target.value.trim() })}
                placeholder="tourist_profiles.name"
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Options (comma-separated; for radio/select/multi)
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

function normalizeFields(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((f, i) => ({
    ...emptyField(),
    ...f,
    field_key: f.field_key || f.key || '',
    help_text: f.help_text || f.subtitle || '',
    sort_order: f.sort_order ?? (i + 1) * 10,
  }));
}

export default function OptInForms() {
  const toast = useToast();
  const [confirm, confirmElement] = useConfirm();
  const { rows, loading, error, reload, save, remove } = useResource(optinCampaignsResource, {
    labelFor: (row) => row.keyword,
  });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const openCreate = () => setEditing(emptyCampaign());
  const openEdit = useCallback((row) => setEditing({
    ...emptyCampaign(),
    ...row,
    entity_slug: row.entity_slug || row.business_slug || '',
    fields: normalizeFields(row.fields),
  }), []);
  const close = () => setEditing(null);

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!editing?.keyword?.trim()) {
      toast.error('Keyword is required');
      return;
    }
    if (!editing?.page_title?.trim()) {
      toast.error('Page title is required');
      return;
    }
    if (!editing?.sms_body?.trim()) {
      toast.error('SMS body is required');
      return;
    }
    if (!editing?.reply_template?.trim()) {
      toast.error('Reply template is required');
      return;
    }
    for (const f of editing.fields || []) {
      if (!f.field_key || !f.label) {
        toast.error('Every field needs a key and label');
        return;
      }
    }
    setSaving(true);
    try {
      const keyword = editing.keyword.trim().toUpperCase();
      const body = {
        ...editing,
        keyword,
        entity_slug: editing.entity_slug?.trim() || null,
        sms_body: editing.sms_body?.trim() || keyword,
        page_subtitle: editing.page_subtitle?.trim() || null,
        cta_label: editing.cta_label?.trim() || null,
        hero_image_url: editing.hero_image_url?.trim() || null,
        consent_scope: editing.consent_scope === 'business' ? 'business' : 'universal',
        fields: (editing.fields || []).map((f, i) => ({
          field_key: f.field_key,
          label: f.label,
          input_type: f.input_type,
          placeholder: f.placeholder || null,
          help_text: f.help_text || null,
          required: !!f.required,
          options: Array.isArray(f.options) && f.options.length ? f.options : null,
          maps_to: f.maps_to || null,
          sort_order: (i + 1) * 10,
        })),
      };
      // Drop UI-only / legacy keys so the API gets the PR #64 shape.
      delete body.business_slug;
      delete body.consent_text;
      delete body.magic_link_base_url;
      delete body.sort_order;
      await save(body);
      toast.success(editing.id ? 'Campaign updated' : 'Campaign created');
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
      title: 'Delete opt-in campaign',
      message: `Delete keyword ${row.keyword}? Existing magic links for this campaign stop working.`,
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

  const tableColumns = useMemo(() => [
    columns.primary('keyword', 'Keyword', 'entity_slug'),
    columns.text('entity_slug', 'Business'),
    columns.text('consent_scope', 'Consent'),
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
        description="Keyword-driven magic-link campaigns (optin_campaigns). A tourist texts the keyword, gets a one-time link, fills consent + fields, and is linked by phone. All data goes through gcr-api-clean."
        actions={(
          <>
            <Button onClick={reload} disabled={loading}>Refresh</Button>
            <Button variant="primary" onClick={openCreate}>Add campaign</Button>
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
            initialSort={{ key: 'keyword', direction: 'asc' }}
            searchPlaceholder="Search keywords…"
            emptyTitle="No opt-in campaigns"
            emptyDescription="Create a campaign with a keyword like BEACH and the fields to collect. Admin CRUD routes must exist on gcr-api-clean."
            emptyAction={<Button variant="primary" onClick={openCreate}>Add campaign</Button>}
          />
        </div>
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={close}
        title={editing?.id ? `Edit ${editing.keyword}` : 'New opt-in campaign'}
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
                Entity slug (optional)
                <input
                  value={editing.entity_slug}
                  onChange={(e) => setEditing({ ...editing, entity_slug: e.target.value })}
                  placeholder="Leave blank for platform-wide"
                />
              </label>
              <label>
                SMS number
                <input
                  value={editing.sms_number}
                  onChange={(e) => setEditing({ ...editing, sms_number: e.target.value })}
                  placeholder="+12562849584"
                  required
                />
              </label>
              <label>
                SMS body (autofill)
                <input
                  value={editing.sms_body}
                  onChange={(e) => setEditing({ ...editing, sms_body: e.target.value })}
                  placeholder="Defaults to keyword"
                />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Reply template (use {'{{url}}'} for magic link)
                <textarea
                  rows={2}
                  value={editing.reply_template}
                  onChange={(e) => setEditing({ ...editing, reply_template: e.target.value })}
                  required
                />
              </label>
              <label>
                Page title
                <input
                  value={editing.page_title}
                  onChange={(e) => setEditing({ ...editing, page_title: e.target.value })}
                  required
                />
              </label>
              <label>
                Submit label
                <input
                  value={editing.submit_label}
                  onChange={(e) => setEditing({ ...editing, submit_label: e.target.value })}
                />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Page subtitle
                <input
                  value={editing.page_subtitle || ''}
                  onChange={(e) => setEditing({ ...editing, page_subtitle: e.target.value })}
                />
              </label>
              <label>
                CTA label
                <input
                  value={editing.cta_label || ''}
                  onChange={(e) => setEditing({ ...editing, cta_label: e.target.value })}
                  placeholder="Text BEACH to Sign Up"
                />
              </label>
              <label>
                Consent scope
                <select
                  value={editing.consent_scope}
                  onChange={(e) => setEditing({ ...editing, consent_scope: e.target.value })}
                >
                  <option value="universal">Universal (GCR)</option>
                  <option value="business">Business</option>
                </select>
              </label>
              <label>
                Terms version
                <input
                  value={editing.terms_version}
                  onChange={(e) => setEditing({ ...editing, terms_version: e.target.value })}
                />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Hero image URL
                <input
                  value={editing.hero_image_url || ''}
                  onChange={(e) => setEditing({ ...editing, hero_image_url: e.target.value })}
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
