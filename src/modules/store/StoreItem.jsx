/**
 * One store item: what it is, its versions, who may have it, and pushing it.
 *
 *   publish   version N exists; nothing moves
 *   release   every entitled business sees N; installed ones get "update
 *             available" and choose when
 *   offer     only the audience sees N early (a staged rollout, or a pilot)
 *   install   put N on the audience's dashboards for them
 *   force     move the audience's installs to N now (a security fix, or a
 *             rollback when N is older)
 *
 * The API skips businesses that are not entitled, and never forces a version
 * that asks for access a business has not accepted: it offers it instead.
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { useAsync } from '../../hooks/useAsync.js';
import {
  PageHeader, Card, Stat, Badge, Button, Notice, LoadingBlock, ErrorState, EmptyState,
} from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useConfirm } from '../../ui/Modal.jsx';
import { TabBar } from '../../ui/Tabs.jsx';
import { Field } from '../../ui/Field.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { formatDateTime } from '../../lib/fields.jsx';
import { describeAudience } from '../automations/Rollouts.jsx';
import { ACCESS_LABEL, accessBadge, notSetUp, SetupNotice } from './Store.jsx';
import '../automations/automations.css';

const ACTIONS = [
  ['release', 'Release to everyone', 'Every business that may have it sees this version. Installed ones get "update available" and choose when.'],
  ['offer', 'Offer early', 'Only the audience below sees it now: a staged rollout, or a pilot before release.'],
  ['install', 'Install for them', 'Put it on the audience\'s dashboards. Businesses that already have it are left alone.'],
  ['force', 'Force this version', 'Move the audience\'s installs to this version now. For a security fix, or pick an older version to roll back.'],
];

export default function StoreItem() {
  const { id } = useParams();
  const [tab, setTab] = useState('push');
  const detail = useAsync(async () => api.get(endpoints.store.item(id)), [id], { initialData: null });
  const [confirm, confirmElement] = useConfirm();

  if (notSetUp(detail.error)) return <SetupNotice />;
  if (detail.error) return <ErrorState error={detail.error} onRetry={detail.reload} />;
  if (!detail.data) return <LoadingBlock />;
  const { item, versions, plans, deployments } = detail.data;

  return (
    <>
      <PageHeader
        title={`${item.icon ? `${item.icon} ` : ''}${item.name}`}
        description={item.summary || <span className="mono">{item.key}</span>}
        breadcrumbs={<><Link to="/store">Store</Link> / {item.name}</>}
      />
      <div className="grid-auto" style={{ marginBottom: 'var(--space-4)' }}>
        <Stat label="Kind" value={item.kind} />
        <Stat label="Who gets it" value={ACCESS_LABEL[item.access] || item.access} />
        <Stat label="Latest" value={item.latest_version ? `v${item.latest_version}` : '—'} />
        <Stat label="Released" value={item.released_version ? `v${item.released_version}` : 'not yet'} tone={item.released_version ? 'success' : 'warning'} />
      </div>
      <TabBar
        tabs={[
          { id: 'push', label: 'Publish & push', icon: '🚀' },
          { id: 'access', label: 'Who gets it', icon: '🔑' },
          { id: 'installs', label: 'Installs', icon: '📥' },
          { id: 'details', label: 'Details', icon: '✏️' },
        ]}
        activeId={tab}
        onChange={setTab}
      />
      <div className="au__gap" />
      {tab === 'push' && <PushTab item={item} versions={versions} deployments={deployments} confirm={confirm} onChanged={detail.reload} />}
      {tab === 'access' && <AccessTab item={item} plans={plans} />}
      {tab === 'installs' && <InstallsTab item={item} />}
      {tab === 'details' && <DetailsTab item={item} onChanged={detail.reload} />}
      {confirmElement}
    </>
  );
}

/* ── publish & push ──────────────────────────────────────────────────── */

function PushTab({ item, versions, deployments, confirm, onChanged }) {
  const toast = useToast();
  const meta = useAsync(async () => api.get(endpoints.store.meta()), [], { initialData: null });
  const [semver, setSemver] = useState('');
  const [manifest, setManifest] = useState('{}');
  const [changelog, setChangelog] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [action, setAction] = useState('release');
  const [version, setVersion] = useState('');
  const [audience, setAudience] = useState({ mode: 'owners', industries: [], slugs: [] });
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const publish = async () => {
    let parsed;
    try {
      parsed = typeof manifest === 'string' ? JSON.parse(manifest || '{}') : manifest;
    } catch {
      toast.error('The manifest is not valid JSON.');
      return;
    }
    setPublishing(true);
    try {
      const r = await api.post(endpoints.store.versions(item.id), { semver, manifest: parsed, changelog });
      toast.success(`Published ${r.version.semver} as v${r.version.version}`);
      setSemver('');
      setChangelog('');
      onChanged();
    } catch (err) {
      toast.error(err);
    } finally {
      setPublishing(false);
    }
  };

  const body = () => ({ action, version: version ? Number(version) : undefined, audience, notes });
  const doPreview = async () => {
    setBusy(true);
    try { setPreview(await api.post(endpoints.store.deployPreview(item.id), body())); } catch (err) { toast.error(err); } finally { setBusy(false); }
  };
  const push = async () => {
    const label = ACTIONS.find(([a]) => a === action)?.[1] || action;
    const v = version || item.latest_version;
    const ok = await confirm({
      title: `${label}: v${v}?`,
      message: action === 'release'
        ? 'Every business entitled to this item will see this version.'
        : `${describeAudience(audience)}. ${preview ? `${preview.apply} will change, ${preview.skip} skipped.` : ''}`,
      confirmLabel: label,
      tone: action === 'force' ? 'danger' : 'primary',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await api.post(endpoints.store.deploy(item.id), body());
      const d = r.deployment;
      toast.success(action === 'release' ? `v${d.version} released` : `${d.applied} changed, ${d.skipped} skipped${d.failed ? `, ${d.failed} failed` : ''}`, 'Pushed');
      setPreview(null);
      setNotes('');
      onChanged();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const industries = meta.data?.industries || [];
  const needsAudience = action !== 'release';

  return (
    <div className="stack">
      <Card title="1. Publish a version" subtitle={item.latest_version ? `Latest is v${item.latest_version}.` : 'Nothing published yet.'}>
        {item.kind === 'app' && (
          <Notice tone="info">
            An app's manifest follows app-manifest v1 and needs a <code>runtime</code>. Name, id, publisher and
            version are filled in for you. <code>permissions</code> is what a business must accept to install.
          </Notice>
        )}
        <div className="au__step-grid">
          <Field field={{ name: 'semver', label: 'Version', type: 'text', placeholder: '1.0.0', required: true }} value={semver} onChange={setSemver} />
          <Field field={{ name: 'changelog', label: 'What changed', type: 'text', placeholder: 'Shown to businesses with the update.' }} value={changelog} onChange={setChangelog} />
          <Field field={{ name: 'manifest', label: 'Manifest', type: 'json', span: 'full', rows: 8 }} value={manifest} onChange={setManifest} />
        </div>
        <Button variant="primary" onClick={publish} loading={publishing} disabled={!semver || item.status === 'archived'}>Publish</Button>
      </Card>

      <Card title="2. Push it" subtitle="Nothing reaches a business until you push. Only businesses allowed to have it are touched.">
        {!item.latest_version && <Notice tone="info">Publish a version first.</Notice>}
        <div className="au__step-grid">
          <div className="au__audience" style={{ gridColumn: '1 / -1' }}>
            {ACTIONS.map(([value, label, help]) => (
              <label className="au__radio" key={value}>
                <input type="radio" name="store-action" checked={action === value} onChange={() => { setAction(value); setPreview(null); }} />
                <span><b>{label}</b><span>{help}</span></span>
              </label>
            ))}
          </div>
          <Field
            field={{ name: 'version', label: 'Version', type: 'select', options: versions.map((v) => ({ value: String(v.version), label: `${v.semver} (v${v.version})${v.version === item.latest_version ? ' · latest' : ''}${v.version === item.released_version ? ' · released' : ''}` })), placeholder: item.latest_version ? `latest (v${item.latest_version})` : '—' }}
            value={version}
            onChange={(v) => { setVersion(v || ''); setPreview(null); }}
          />
          {needsAudience && (
            <div className="au__audience" style={{ gridColumn: '1 / -1' }}>
              {[
                ['owners', 'Businesses with a login', 'Everyone who can open a dashboard.'],
                ['industries', 'Certain industries', 'Every active business of the types you pick.'],
                ['slugs', 'Named businesses', 'A hand-picked list: a pilot, or a fix for one.'],
                ['all', 'Every active listing', 'Includes businesses without a login yet.'],
              ].map(([mode, label, help]) => (
                <label className="au__radio" key={mode}>
                  <input type="radio" name="store-audience" checked={audience.mode === mode} onChange={() => { setAudience({ ...audience, mode }); setPreview(null); }} />
                  <span><b>{label}</b><span>{help}</span></span>
                </label>
              ))}
            </div>
          )}
          {needsAudience && audience.mode === 'industries' && (
            <Field
              field={{ name: 'industries', label: 'Industries', type: 'multiselect', span: 'full', options: industries.map((i) => ({ value: i.value, label: `${i.value} (${i.count})` })) }}
              value={audience.industries}
              onChange={(v) => { setAudience({ ...audience, industries: v }); setPreview(null); }}
            />
          )}
          {needsAudience && audience.mode === 'slugs' && (
            <Field field={{ name: 'slugs', label: 'Business slugs', type: 'tags', span: 'full', placeholder: 'flora-bama, the-wharf, …' }} value={audience.slugs} onChange={(v) => { setAudience({ ...audience, slugs: v }); setPreview(null); }} />
          )}
          <Field field={{ name: 'notes', label: 'Notes', type: 'text', span: 'full', placeholder: 'Optional; kept with the push.' }} value={notes} onChange={setNotes} />
        </div>
        <div className="au__gap" />
        <div className="row-wrap" style={{ gap: 8, alignItems: 'center' }}>
          {needsAudience && <Button onClick={doPreview} loading={busy && !preview} disabled={!item.latest_version}>Preview</Button>}
          <Button variant="primary" onClick={push} loading={busy} disabled={!item.latest_version || (needsAudience && !preview)}>Push</Button>
          {needsAudience && !preview && item.latest_version > 0 && <span className="muted">Preview first: you see the count before anything changes.</span>}
        </div>
        {preview && (
          <>
            <div className="au__gap" />
            <div className="au__preview">
              <b>{preview.targeted}</b> in the audience · <b>{preview.apply}</b> will change · <b>{preview.skip}</b> skipped
              {preview.needs_consent > 0 && <> · <b>{preview.needs_consent}</b> asked to accept new access instead of forced</>}
              {Object.keys(preview.reasons || {}).length > 0 && (
                <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                  Skipped: {Object.entries(preview.reasons).map(([why, n]) => `${n} ${why.replace(/_/g, ' ')}`).join(' · ')}
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      <Card title="Versions">
        {versions.length ? (
          <DataTable
            columns={[
              { key: 'semver', header: 'Version', render: (v) => <span className="mono">{v.semver}</span> },
              { key: 'version', header: '#', render: (v) => <Badge tone={v.version === item.released_version ? 'success' : 'info'}>v{v.version}{v.version === item.released_version ? ' released' : ''}</Badge> },
              { key: 'permissions', header: 'Asks for', render: (v) => (v.permissions?.length ? v.permissions.join(', ') : <span className="faint">nothing</span>) },
              { key: 'changelog', header: 'Changes', render: (v) => v.changelog || <span className="faint">—</span> },
              { key: 'published_at', header: 'Published', render: (v) => formatDateTime(v.published_at) },
            ]}
            rows={versions}
            rowKey="version"
            searchable={false}
          />
        ) : <EmptyState icon="🏷️" title="No versions yet" />}
      </Card>

      <Card title="Pushes" subtitle="newest first">
        {deployments.length ? (
          <DataTable
            columns={[
              { key: 'created_at', header: 'When', render: (d) => formatDateTime(d.created_at) },
              { key: 'action', header: 'What', render: (d) => <Badge tone={d.action === 'force' ? 'warning' : 'info'}>{d.action}</Badge> },
              { key: 'version', header: 'Version', render: (d) => `v${d.version}` },
              { key: 'audience', header: 'To', render: (d) => (d.action === 'release' ? 'Everyone entitled' : describeAudience(d.audience)) },
              { key: 'applied', header: 'Changed', align: 'right' },
              { key: 'skipped', header: 'Skipped', align: 'right' },
              { key: 'failed', header: 'Failed', align: 'right', render: (d) => (d.failed ? <Badge tone="danger">{d.failed}</Badge> : <span className="faint">0</span>) },
              { key: 'notes', header: 'Notes', render: (d) => d.notes || <span className="faint">—</span> },
            ]}
            rows={deployments}
            rowKey="id"
            pageSize={10}
            searchable={false}
          />
        ) : <EmptyState icon="🚀" title="Never pushed" />}
      </Card>
    </div>
  );
}

/* ── who gets it ─────────────────────────────────────────────────────── */

function AccessTab({ item, plans }) {
  const toast = useToast();
  const grants = useAsync(async () => api.get(`${endpoints.store.grants()}?item_id=${encodeURIComponent(item.id)}`), [item.id], { initialData: null });
  const [slugs, setSlugs] = useState([]);
  const [note, setNote] = useState('');
  const [expires, setExpires] = useState('');

  const grant = async () => {
    try {
      const r = await api.post(endpoints.store.grants(), { item_id: item.id, slugs, note, expires_at: expires || null });
      toast.success(`${r.granted} granted${r.already ? `, ${r.already} already had it` : ''}`);
      setSlugs([]);
      setNote('');
      grants.reload();
    } catch (err) { toast.error(err); }
  };
  const revoke = async (g) => {
    try {
      await api.del(endpoints.store.grant(g.id));
      toast.success(`${g.entity_slug}: revoked`);
      grants.reload();
    } catch (err) { toast.error(err); }
  };

  return (
    <div className="stack">
      <Card title="How businesses reach it" subtitle={accessBadge(item.access)}>
        {item.access === 'free' && <p>Every business may have it. Nothing to set.</p>}
        {item.access === 'plan' && (
          <p>
            Plans that include it: {plans.length ? plans.map((p) => <Badge key={p} tone="info">{p}</Badge>) : <b>none yet</b>}.
            {' '}Change which plans include it on the <Link to="/store">Store → Plans</Link> tab.
            Grants below reach it too.
          </p>
        )}
        {item.access === 'grant' && <p>Only businesses you grant it to below.</p>}
        <p className="muted">Change how it is reached on the Details tab.</p>
      </Card>

      <Card title="Grant it to businesses" subtitle="For a pilot, a comp, or a partner. Can expire; can be revoked.">
        <div className="au__step-grid">
          <Field field={{ name: 'slugs', label: 'Business slugs', type: 'tags', span: 'full', placeholder: 'flora-bama, …' }} value={slugs} onChange={setSlugs} />
          <Field field={{ name: 'note', label: 'Why', type: 'text' }} value={note} onChange={setNote} />
          <Field field={{ name: 'expires', label: 'Expires', type: 'date' }} value={expires} onChange={setExpires} />
        </div>
        <Button variant="primary" onClick={grant} disabled={!slugs.length}>Grant</Button>
      </Card>

      <Card title="Live grants">
        {grants.error && <ErrorState error={grants.error} onRetry={grants.reload} />}
        {grants.data && (grants.data.grants.length ? (
          <DataTable
            columns={[
              { key: 'entity_slug', header: 'Business', render: (g) => <span className="mono">{g.entity_slug}</span> },
              { key: 'note', header: 'Why', render: (g) => g.note || <span className="faint">—</span> },
              { key: 'expires_at', header: 'Expires', render: (g) => (g.expires_at ? formatDateTime(g.expires_at) : <span className="faint">never</span>) },
              { key: 'created_at', header: 'Granted', render: (g) => formatDateTime(g.created_at) },
              { key: 'id', header: '', render: (g) => <Button size="sm" onClick={() => revoke(g)}>Revoke</Button> },
            ]}
            rows={grants.data.grants}
            rowKey="id"
            searchable={false}
          />
        ) : <EmptyState icon="🔑" title="No grants" />)}
      </Card>
    </div>
  );
}

/* ── installs ────────────────────────────────────────────────────────── */

function InstallsTab({ item }) {
  const query = useAsync(async () => api.get(endpoints.store.installs(item.id)), [item.id], { initialData: null });
  if (query.error) return <ErrorState error={query.error} onRetry={query.reload} />;
  if (!query.data) return <LoadingBlock />;
  const rows = query.data.installs || [];
  const on = (v) => rows.filter((r) => r.version === v && r.status !== 'offered' && r.status !== 'uninstalled').length;
  return (
    <Card padded={false} title="Who has it" subtitle={item.released_version ? `${on(item.released_version)} on the released version` : undefined}>
      <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
        <DataTable
          columns={[
            { key: 'entity_slug', header: 'Business', render: (r) => <span className="mono">{r.entity_slug}</span> },
            { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'installed' ? 'success' : r.status === 'offered' ? 'info' : 'neutral'}>{r.status}</Badge> },
            { key: 'version', header: 'Version', render: (r) => `v${r.version}` },
            { key: 'offered_version', header: 'Offered early', render: (r) => (r.offered_version ? `v${r.offered_version}` : <span className="faint">—</span>) },
            { key: 'updated_at', header: 'Changed', render: (r) => formatDateTime(r.updated_at) },
          ]}
          rows={rows}
          rowKey="entity_slug"
          searchPlaceholder="Search businesses…"
          emptyTitle="Nobody has it yet"
        />
      </div>
    </Card>
  );
}

/* ── details ─────────────────────────────────────────────────────────── */

function DetailsTab({ item, onChanged }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: item.name || '', summary: item.summary || '', description: item.description || '',
    icon: item.icon || '', category: item.category || '', access: item.access,
  });
  const set = (name) => (value) => setForm((f) => ({ ...f, [name]: value }));
  const save = async (extra = {}) => {
    try {
      await api.put(endpoints.store.item(item.id), { ...form, ...extra });
      toast.success('Saved');
      onChanged();
    } catch (err) { toast.error(err); }
  };
  return (
    <Card title="Details" subtitle={<span className="mono">{item.key} · {item.kind}</span>}>
      <div className="au__step-grid">
        <Field field={{ name: 'name', label: 'Name', type: 'text' }} value={form.name} onChange={set('name')} />
        <Field field={{ name: 'access', label: 'Who gets it', type: 'select', options: Object.entries(ACCESS_LABEL).map(([value, label]) => ({ value, label })) }} value={form.access} onChange={set('access')} />
        <Field field={{ name: 'summary', label: 'One line', type: 'text', span: 'full' }} value={form.summary} onChange={set('summary')} />
        <Field field={{ name: 'description', label: 'Description', type: 'textarea', span: 'full', rows: 4 }} value={form.description} onChange={set('description')} />
        <Field field={{ name: 'icon', label: 'Icon', type: 'text' }} value={form.icon} onChange={set('icon')} />
        <Field field={{ name: 'category', label: 'Category', type: 'text' }} value={form.category} onChange={set('category')} />
      </div>
      <div className="row-wrap" style={{ gap: 8 }}>
        <Button variant="primary" onClick={() => save()}>Save</Button>
        {item.status !== 'archived'
          ? <Button onClick={() => save({ status: 'archived' })}>Archive</Button>
          : <Button onClick={() => save({ status: 'published' })}>Unarchive</Button>}
      </div>
      {item.status === 'archived' && <Notice tone="warning">Archived: hidden from every business's store. Installs stay.</Notice>}
    </Card>
  );
}
