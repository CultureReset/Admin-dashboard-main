/**
 * The store.
 *
 * Everything the operator ships lives here as one catalog: apps, modules,
 * maps, parsers, automation packs, Ghost box releases. Each item is reached by
 * a business in one of three ways, and only those:
 *
 *   free   every business
 *   plan   the business's plan includes it (Plans tab)
 *   grant  the operator gave it to that business by hand (on the item)
 *
 * Nothing here decides access itself; the API does (lib/entitlements.js).
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { useAsync } from '../../hooks/useAsync.js';
import {
  PageHeader, Card, Stat, Badge, Button, Notice, LoadingBlock, ErrorState, EmptyState,
} from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { TabBar } from '../../ui/Tabs.jsx';
import { Field } from '../../ui/Field.jsx';
import { useToast } from '../../ui/Toast.jsx';
import '../automations/automations.css';

export const ACCESS_LABEL = {
  free: 'Free for everyone',
  plan: 'By plan',
  grant: 'By grant only',
};

export function accessBadge(access) {
  const tone = access === 'free' ? 'success' : access === 'grant' ? 'warning' : 'info';
  return <Badge tone={tone}>{ACCESS_LABEL[access] || access}</Badge>;
}

export function notSetUp(error) {
  return error?.status === 501;
}

export function SetupNotice() {
  return (
    <Notice tone="warning" title="The store is not on the database yet">
      <p>Run <code>sql/billing.sql</code> then <code>sql/store.sql</code> from gcr-api-clean on the live project.</p>
    </Notice>
  );
}

export default function Store() {
  const [tab, setTab] = useState('items');
  return (
    <>
      <PageHeader
        title="Store"
        description="Add what you sell, publish versions, decide who gets it, and push updates."
      />
      <TabBar
        tabs={[
          { id: 'items', label: 'Items', icon: '📦' },
          { id: 'plans', label: 'Plans', icon: '💳' },
          { id: 'business', label: 'One business', icon: '🏢' },
        ]}
        activeId={tab}
        onChange={setTab}
      />
      <div className="au__gap" />
      {tab === 'items' && <ItemsTab />}
      {tab === 'plans' && <PlansTab />}
      {tab === 'business' && <BusinessTab />}
    </>
  );
}

/* ── items ───────────────────────────────────────────────────────────── */

function ItemsTab() {
  const navigate = useNavigate();
  const items = useAsync(async () => api.get(endpoints.store.items()), [], { initialData: null });
  const meta = useAsync(async () => api.get(endpoints.store.meta()), [], { initialData: null });
  const [adding, setAdding] = useState(false);
  const rows = items.data?.items || [];

  if (notSetUp(items.error)) return <SetupNotice />;
  if (items.error) return <ErrorState error={items.error} onRetry={items.reload} />;
  if (items.loading && !items.data) return <LoadingBlock />;

  const released = rows.filter((r) => r.released_version).length;
  const installs = rows.reduce((n, r) => n + (r.installs?.installed || 0), 0);

  return (
    <div className="stack">
      <div className="grid-auto">
        <Stat label="Items" value={rows.length} />
        <Stat label="Released" value={released} tone={released ? 'success' : 'neutral'} />
        <Stat label="Installs" value={installs} />
      </div>
      <Card
        padded={false}
        title="Catalog"
        actions={<Button variant="primary" onClick={() => setAdding(true)}>+ Add item</Button>}
      >
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <DataTable
            columns={[
              { key: 'name', header: 'Item', render: (r) => <span className="ui-cell-primary">{r.icon ? `${r.icon} ` : ''}{r.name}</span> },
              { key: 'kind', header: 'Kind', render: (r) => <span className="mono">{r.kind}</span> },
              { key: 'access', header: 'Who gets it', render: (r) => accessBadge(r.access) },
              { key: 'latest_version', header: 'Latest', render: (r) => (r.latest_version ? <Badge tone="info">v{r.latest_version}</Badge> : <span className="faint">none</span>) },
              { key: 'released_version', header: 'Released', render: (r) => (r.released_version ? <Badge tone="success">v{r.released_version}</Badge> : <span className="faint">not yet</span>) },
              { key: 'installs', header: 'Installed', align: 'right', render: (r) => r.installs?.installed || 0 },
            ]}
            rows={rows}
            rowKey="id"
            onRowClick={(r) => navigate(`/store/items/${r.id}`)}
            searchPlaceholder="Search items…"
            emptyTitle="Nothing in the store yet"
            emptyDescription="Add the first item: an app, a module, a map, a Ghost box release."
          />
        </div>
      </Card>
      {adding && (
        <AddItem
          kinds={meta.data?.kinds || []}
          onClose={() => setAdding(false)}
          onDone={(item) => { setAdding(false); navigate(`/store/items/${item.id}`); }}
        />
      )}
    </div>
  );
}

function AddItem({ kinds, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ key: '', name: '', kind: 'app', access: 'plan', summary: '', icon: '', category: '' });
  const [saving, setSaving] = useState(false);
  const set = (name) => (value) => setForm((f) => ({ ...f, [name]: value }));
  const save = async () => {
    setSaving(true);
    try {
      const { item } = await api.post(endpoints.store.items(), form);
      toast.success(`${item.name} added`);
      onDone(item);
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Add an item"
      description="It starts as a draft. Publish a version and push it when it is ready."
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={!form.key || !form.name}>Add</Button>
        </>
      )}
    >
      <div className="au__step-grid">
        <Field field={{ name: 'name', label: 'Name', type: 'text', required: true }} value={form.name} onChange={set('name')} />
        <Field field={{ name: 'key', label: 'Key', type: 'text', required: true, placeholder: 'song-requests', help: 'Lowercase, never changes.' }} value={form.key} onChange={(v) => set('key')(String(v || '').toLowerCase())} />
        <Field field={{ name: 'kind', label: 'Kind', type: 'select', options: kinds.map((k) => ({ value: k, label: k })) }} value={form.kind} onChange={set('kind')} />
        <Field
          field={{ name: 'access', label: 'Who gets it', type: 'select', options: Object.entries(ACCESS_LABEL).map(([value, label]) => ({ value, label })) }}
          value={form.access}
          onChange={set('access')}
        />
        <Field field={{ name: 'summary', label: 'One line', type: 'text', span: 'full' }} value={form.summary} onChange={set('summary')} />
        <Field field={{ name: 'icon', label: 'Icon', type: 'text', placeholder: '🎵' }} value={form.icon} onChange={set('icon')} />
        <Field field={{ name: 'category', label: 'Category', type: 'text' }} value={form.category} onChange={set('category')} />
      </div>
    </Modal>
  );
}

/* ── plans ───────────────────────────────────────────────────────────── */

function PlansTab() {
  const toast = useToast();
  const plans = useAsync(async () => api.get(endpoints.store.plans()), [], { initialData: null });
  const items = useAsync(async () => api.get(endpoints.store.items()), [], { initialData: null });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ key: '', name: '', price_monthly: 0 });

  if (notSetUp(plans.error) || notSetUp(items.error)) return <SetupNotice />;
  if (plans.error) return <ErrorState error={plans.error} onRetry={plans.reload} />;
  if (!plans.data || !items.data) return <LoadingBlock />;

  const planItems = (items.data.items || []).filter((i) => i.access === 'plan');

  const setItems = async (plan, itemIds) => {
    try {
      await api.put(endpoints.store.plan(plan.key), { item_ids: itemIds });
      toast.success(`${plan.name} updated`);
      plans.reload();
    } catch (err) { toast.error(err); }
  };
  const setPrice = async (plan, price) => {
    try {
      await api.put(endpoints.store.plan(plan.key), { price_monthly: Number(price) || 0 });
      plans.reload();
    } catch (err) { toast.error(err); }
  };
  const create = async () => {
    try {
      await api.post(endpoints.store.plans(), draft);
      toast.success(`${draft.name} created`);
      setAdding(false);
      setDraft({ key: '', name: '', price_monthly: 0 });
      plans.reload();
    } catch (err) { toast.error(err); }
  };

  return (
    <div className="stack">
      <Notice tone="info">
        A plan includes the items marked <b>By plan</b>. A business on a plan gets its items; free items reach everyone;
        grant-only items are given one business at a time from the item's page.
      </Notice>
      {(plans.data.plans || []).map((plan) => (
        <PlanCard key={plan.key} plan={plan} planItems={planItems} onSetItems={setItems} onSavePrice={setPrice} />
      ))}
      {adding ? (
        <Card title="New plan">
          <div className="au__step-grid">
            <Field field={{ name: 'name', label: 'Name', type: 'text' }} value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
            <Field field={{ name: 'key', label: 'Key', type: 'text', placeholder: 'pro' }} value={draft.key} onChange={(v) => setDraft({ ...draft, key: String(v || '').toLowerCase() })} />
            <Field field={{ name: 'price', label: 'Price / month', type: 'number' }} value={draft.price_monthly} onChange={(v) => setDraft({ ...draft, price_monthly: v })} />
          </div>
          <div className="row-wrap" style={{ gap: 8 }}>
            <Button onClick={() => setAdding(false)}>Cancel</Button>
            <Button variant="primary" onClick={create} disabled={!draft.key || !draft.name}>Create plan</Button>
          </div>
        </Card>
      ) : (
        <Button onClick={() => setAdding(true)}>+ New plan</Button>
      )}
    </div>
  );
}

function PlanCard({ plan, planItems, onSetItems, onSavePrice }) {
  const [price, setPriceDraft] = useState(plan.price_monthly);
  const changed = Number(price) !== Number(plan.price_monthly);
  return (
    <Card title={`${plan.name}${plan.is_default ? ' (default)' : ''}`} subtitle={<span className="mono">{plan.key}</span>}>
      <div className="au__step-grid">
        <Field field={{ name: 'price', label: 'Price / month', type: 'number' }} value={price} onChange={setPriceDraft} />
        <div style={{ alignSelf: 'end' }}>
          <Button onClick={() => onSavePrice(plan, price)} disabled={!changed}>Save price</Button>
        </div>
        <Field
          field={{ name: 'items', label: 'Includes', type: 'multiselect', span: 'full', options: planItems.map((i) => ({ value: i.id, label: i.name })) }}
          value={plan.item_ids || []}
          onChange={(v) => onSetItems(plan, v)}
        />
      </div>
      {!planItems.length && <p className="muted">No items are sold by plan yet.</p>}
    </Card>
  );
}

/* ── one business ────────────────────────────────────────────────────── */

function BusinessTab() {
  const toast = useToast();
  const [slug, setSlug] = useState('');
  const [looked, setLooked] = useState('');
  const view = useAsync(async () => (looked ? api.get(endpoints.store.business(looked)) : null), [looked], { initialData: null });
  const plans = useAsync(async () => api.get(endpoints.store.plans()), [], { initialData: null });

  const changePlan = async (planKey) => {
    try {
      await api.put(endpoints.store.businessPlan(looked), { plan_key: planKey });
      toast.success(`${looked} is now on ${planKey}`);
      view.reload();
    } catch (err) { toast.error(err); }
  };

  return (
    <div className="stack">
      <Card title="Look up a business" subtitle="Its plan, what it may have and why, and what it has installed.">
        <div className="row-wrap" style={{ gap: 8, alignItems: 'flex-end' }}>
          <Field field={{ name: 'slug', label: 'Business slug', type: 'text', placeholder: 'flora-bama' }} value={slug} onChange={setSlug} />
          <Button variant="primary" onClick={() => setLooked(String(slug || '').trim())} disabled={!String(slug || '').trim()}>Look up</Button>
        </div>
      </Card>
      {notSetUp(view.error) && <SetupNotice />}
      {view.error && !notSetUp(view.error) && <ErrorState error={view.error} onRetry={view.reload} />}
      {view.data && (
        <Card title={view.data.slug} subtitle={`Plan: ${view.data.plan || 'none'}`}>
          {plans.data?.plans?.length > 0 && (
            <div className="au__step-grid">
              <Field
                field={{ name: 'plan', label: 'Plan', type: 'select', options: plans.data.plans.map((p) => ({ value: p.key, label: p.name })) }}
                value={view.data.plan || ''}
                onChange={(v) => v && changePlan(v)}
              />
            </div>
          )}
          {view.data.items.length ? (
            <DataTable
              columns={[
                { key: 'name', header: 'Item', render: (r) => <Link to={`/store/items/${r.id}`}>{r.name}</Link> },
                { key: 'kind', header: 'Kind', render: (r) => <span className="mono">{r.kind}</span> },
                { key: 'entitlement', header: 'May have it', render: (r) => (r.entitlement.ok ? <Badge tone="success">yes · {r.entitlement.reason}</Badge> : <Badge tone="neutral">no</Badge>) },
                { key: 'install', header: 'Has it', render: (r) => (r.install ? `${r.install.status} v${r.install.version}` : <span className="faint">—</span>) },
              ]}
              rows={view.data.items}
              rowKey="id"
              searchable={false}
            />
          ) : <EmptyState icon="📦" title="No published items" />}
        </Card>
      )}
    </div>
  );
}
