/**
 * Store publishing: create store items, release versions, publish them.
 *
 * Releases follow the Red Hat model: a channel (stable for everyone, fast for
 * early access) and an advisory type. Businesses on automatic updates get a
 * release at once; manual ones see an Update button. A required security fix
 * reaches every install.
 */

import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../api/paperclip.js';
import { Badge, Button, PageHeader } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import PaperclipSignIn from './SignIn.jsx';

const KINDS = [
  ['pack', 'Pack'],
  ['skill', 'Skill'],
  ['automation', 'Automation'],
  ['connector', 'Connector'],
  ['plugin', 'Plugin'],
];
const STATUS_TONE = { published: 'success', draft: 'neutral', retired: 'warning' };
const STATUS_LABEL = { published: 'Published', draft: 'Draft', retired: 'Unpublished' };

const CONTENTS_EXAMPLE = JSON.stringify(
  {
    menu: ['tasks'],
    skills: [{ key: 'booking', name: 'Booking', markdown: '# Booking\n\nHow to book a charter.' }],
    agents: [{ key: 'receptionist', name: 'Receptionist', instructions: 'Answer calls and book trips.' }],
    routines: [{ key: 'morning', title: 'Morning check', agentKey: 'receptionist', cron: '0 8 * * *' }],
  },
  null,
  2,
);

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function Labeled({ label, children, hint }) {
  return (
    <label className="stack-sm" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{label}</span>
      {children}
      {hint && <small className="faint">{hint}</small>}
    </label>
  );
}

function NewItemModal({ open, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', key: '', kind: 'pack', summary: '', pluginKey: '' });
  const [busy, setBusy] = useState(false);
  const set = (field) => (e) =>
    setForm((f) => {
      const next = { ...f, [field]: e.target.value };
      if (field === 'name' && f.key === slugify(f.name)) next.key = slugify(e.target.value);
      return next;
    });

  async function save() {
    setBusy(true);
    try {
      await adminApi.createItem({
        name: form.name,
        key: form.key,
        kind: form.kind,
        summary: form.summary || null,
        pluginKey: form.kind === 'plugin' ? form.pluginKey : null,
      });
      toast.success(`Created ${form.name}. Add a release, then publish it.`);
      setForm({ name: '', key: '', kind: 'pack', summary: '', pluginKey: '' });
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New store item"
      description="It stays a draft until it has a release and you publish it."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!form.name || !form.key || (form.kind === 'plugin' && !form.pluginKey)}
            onClick={save}
          >
            Create
          </Button>
        </>
      }
    >
      <div className="stack">
        <Labeled label="Name"><input value={form.name} onChange={set('name')} /></Labeled>
        <Labeled label="Key" hint="Lowercase letters, numbers and dashes. Cannot change later.">
          <input value={form.key} onChange={set('key')} placeholder="front-desk" />
        </Labeled>
        <Labeled label="Type">
          <select value={form.kind} onChange={set('kind')}>
            {KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Labeled>
        {form.kind === 'plugin' && (
          <Labeled label="Plugin key"><input value={form.pluginKey} onChange={set('pluginKey')} /></Labeled>
        )}
        <Labeled label="Short description"><textarea rows={2} value={form.summary} onChange={set('summary')} /></Labeled>
      </div>
    </Modal>
  );
}

function ReleaseModal({ item, onClose, onSaved }) {
  const toast = useToast();
  const [version, setVersion] = useState('');
  const [channel, setChannel] = useState('stable');
  const [advisoryType, setAdvisoryType] = useState('enhancement');
  const [required, setRequired] = useState(false);
  const [changelog, setChangelog] = useState('');
  const [contents, setContents] = useState('');
  const [busy, setBusy] = useState(false);

  // Start from the previous release so a release only changes what is new.
  useEffect(() => {
    if (!item) return;
    const previous = item.versions?.[0]?.payload;
    setContents(previous && Object.keys(previous).length ? JSON.stringify(previous, null, 2) : '');
    setVersion('');
    setChangelog('');
    setChannel('stable');
    setAdvisoryType('enhancement');
    setRequired(false);
  }, [item]);

  let payload = {};
  let contentsError = null;
  if (contents.trim()) {
    try {
      payload = JSON.parse(contents);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Contents must be a JSON object');
    } catch (err) {
      contentsError = err.message;
    }
  }

  async function save() {
    setBusy(true);
    try {
      const result = await adminApi.release(item.id, {
        version,
        channel,
        advisoryType,
        required: advisoryType === 'security' && required,
        changelog: changelog || null,
        payload,
      });
      const n = (count) => `${count} ${count === 1 ? 'business' : 'businesses'}`;
      toast.success(
        `Released v${version}. Updated ${n(result.appliedTo)}; ${n(result.pendingFor)} update manually.` +
          (result.failedFor?.length ? ` Failed for ${n(result.failedFor.length)} — they can retry.` : ''),
      );
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={item !== null}
      onClose={onClose}
      title={`New release of ${item?.name ?? ''}`}
      description="Automatic businesses get it right away. Manual ones see an Update button."
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={!version || !!contentsError} onClick={save}>
            Release
          </Button>
        </>
      }
    >
      <div className="stack">
        <Labeled label="Version"><input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" /></Labeled>
        <div className="row-wrap" style={{ gap: 12 }}>
          <Labeled label="Channel">
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="stable">Stable (everyone)</option>
              <option value="fast">Fast (early access only)</option>
            </select>
          </Labeled>
          <Labeled label="Type">
            <select value={advisoryType} onChange={(e) => setAdvisoryType(e.target.value)}>
              <option value="enhancement">New feature</option>
              <option value="bugfix">Bug fix</option>
              <option value="security">Security fix</option>
            </select>
          </Labeled>
        </div>
        <Labeled label="What changed"><textarea rows={3} value={changelog} onChange={(e) => setChangelog(e.target.value)} /></Labeled>
        {item?.kind !== 'plugin' && (
          <Labeled
            label="Contents"
            hint="The skills, agents and routines a business gets, plus menu entries it turns on. Anything left out of a release is removed from businesses that take it."
          >
            <textarea
              rows={10}
              value={contents}
              onChange={(e) => setContents(e.target.value)}
              placeholder={CONTENTS_EXAMPLE}
              style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}
            />
            {contentsError && <small style={{ color: 'var(--danger, #e5484d)' }}>{contentsError}</small>}
          </Labeled>
        )}
        {advisoryType === 'security' && (
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
            Required: install it for every business, even manual ones
          </label>
        )}
      </div>
    </Modal>
  );
}

export default function StorePublishing() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [releasing, setReleasing] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await adminApi.storeItems());
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePublish(item) {
    setBusyId(item.id);
    try {
      if (item.status === 'published') await adminApi.unpublish(item.id);
      else await adminApi.publish(item.id);
      toast.success(item.status === 'published' ? `Unpublished ${item.name}` : `Published ${item.name}`);
      await load();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="stack">
      <PageHeader
        title="Store publishing"
        description="What you publish here shows in every business's store. A business only gets an item after installing it."
        actions={<Button variant="primary" onClick={() => setCreating(true)}>New item</Button>}
      />
      {error?.isAuthError ? <PaperclipSignIn onDone={load} /> : null}
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        searchPlaceholder="Search store items…"
        emptyTitle="No store items yet"
        emptyDescription="Create an item, add a release, then publish it."
        columns={[
          {
            key: 'name',
            header: 'Item',
            render: (row) => (
              <span className="stack-sm" style={{ display: 'flex', flexDirection: 'column' }}>
                <strong>{row.name}</strong>
                <small className="faint">{row.summary || row.key}</small>
              </span>
            ),
          },
          { key: 'kind', header: 'Type', render: (row) => KINDS.find(([k]) => k === row.kind)?.[1] ?? row.kind },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status] ?? row.status}</Badge>,
          },
          {
            key: 'latest',
            header: 'Latest',
            render: (row) => (row.versions?.[0] ? `v${row.versions[0].version} (${row.versions[0].channel})` : '—'),
          },
          { key: 'installCount', header: 'Installs' },
          {
            key: 'actions',
            header: '',
            sortable: false,
            render: (row) => (
          <div className="row" style={{ gap: 6 }}>
            <Button size="sm" onClick={() => setReleasing(row)}>New release</Button>
            <Button
              size="sm"
              variant={row.status === 'published' ? 'ghost' : 'primary'}
              loading={busyId === row.id}
              onClick={() => togglePublish(row)}
            >
              {row.status === 'published' ? 'Unpublish' : 'Publish'}
            </Button>
          </div>
            ),
          },
        ]}
      />
      <NewItemModal open={creating} onClose={() => setCreating(false)} onSaved={load} />
      <ReleaseModal item={releasing} onClose={() => setReleasing(null)} onSaved={load} />
    </div>
  );
}
