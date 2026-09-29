/**
 * Automation builder — one automation, end to end.
 *
 *   Build      identity, trigger, and the chain of steps
 *   Settings   the fields a business fills in on its own dashboard
 *   Test       run the draft against one business, side effects off
 *   Push       publish a version, then deploy it to an audience
 *   Installs   who has it, at which version; switch on/off, run, remove
 *   Versions   every published snapshot
 *   Runs       this automation's recent executions
 *
 * Nothing about a step type is written here. The palette, each step's form
 * and the trigger types come from GET /api/admin/automations/meta, so a new
 * step type in the API's engine appears in this builder with no change.
 *
 * Editing the draft changes nothing on any dashboard. Publish snapshots it;
 * Push is what moves businesses onto the new version.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { useAsync } from '../../hooks/useAsync.js';
import {
  PageHeader, Card, Stat, Badge, Button, Notice, LoadingBlock, ErrorState, EmptyState,
} from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Modal, useConfirm } from '../../ui/Modal.jsx';
import { TabBar } from '../../ui/Tabs.jsx';
import { Field } from '../../ui/Field.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { formatDateTime } from '../../lib/fields.jsx';
import { describeTrigger } from './Automations.jsx';
import { describeAudience } from './Rollouts.jsx';
import { RunRow, RunSteps, RunStatus } from './RunLog.jsx';
import './automations.css';

const TABS = [
  { id: 'build', label: 'Build', icon: '🧱' },
  { id: 'settings', label: 'Settings', icon: '🎛️' },
  { id: 'test', label: 'Test', icon: '🧪' },
  { id: 'push', label: 'Publish & push', icon: '🚀' },
  { id: 'installs', label: 'Installs', icon: '🏢' },
  { id: 'versions', label: 'Versions', icon: '🗂️' },
  { id: 'runs', label: 'Runs', icon: '🧾' },
];

const DRAFT_KEYS = ['name', 'key', 'description', 'icon', 'category', 'kind', 'trigger', 'steps', 'config_schema'];
const pickDraft = (a) => Object.fromEntries(DRAFT_KEYS.map((k) => [k, a?.[k]]));

/** Map the engine's field types onto the dashboard's controls. */
function controlFor(f) {
  const base = { name: f.key, label: f.label, help: f.help, placeholder: f.placeholder, rows: f.rows };
  switch (f.type) {
    case 'textarea': return { ...base, type: 'textarea', span: 'full' };
    case 'json': return { ...base, type: 'json', span: 'full', rows: f.rows || 4 };
    case 'code': return { ...base, type: 'json', span: 'full', rows: f.rows || 12 };
    case 'number': return { ...base, type: 'number' };
    case 'boolean': return { ...base, type: 'boolean' };
    case 'select': return { ...base, type: 'select', options: f.options || [] };
    default: return { ...base, type: 'text' };
  }
}

const isJsonField = (f) => f.type === 'json';
function jsonProblem(value) {
  if (value == null || value === '' || typeof value !== 'string') return null;
  try { JSON.parse(value); return null; } catch { return 'Not valid JSON yet'; }
}

function newStepId(type, existing) {
  const base = String(type).split('.').pop().replace(/[^a-z0-9]/gi, '_').toLowerCase();
  let id = base;
  let n = 1;
  const taken = new Set(existing.map((s) => s.id));
  while (taken.has(id)) id = `${base}_${(n += 1)}`;
  return id;
}

export default function Builder() {
  const { id } = useParams();
  const toast = useToast();
  const [confirm, confirmElement] = useConfirm();
  const [tab, setTab] = useState('build');
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const meta = useAsync(async () => api.get(endpoints.automations.meta()), [], { initialData: null });
  const detail = useAsync(async () => api.get(endpoints.automations.item(id)), [id], { initialData: null });

  useEffect(() => {
    if (detail.data?.automation) {
      setDraft(pickDraft(detail.data.automation));
      setDirty(false);
    }
  }, [detail.data]);

  const patch = useCallback((changes) => {
    setDraft((d) => ({ ...d, ...changes }));
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const { automation, problems } = await api.put(endpoints.automations.item(id), draft);
      setDraft(pickDraft(automation));
      setDirty(false);
      if (problems?.length) toast.warning(problems[0], 'Saved with problems');
      else toast.success('Draft saved');
      detail.reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  }, [draft, id, toast, detail]);

  const automation = detail.data?.automation;
  const stats = detail.data?.stats || {};

  if (detail.loading && !detail.data) return <LoadingBlock label="Loading automation…" />;
  if (detail.error) return <ErrorState error={detail.error} onRetry={detail.reload} context="automation" />;
  if (!automation || !draft) return <EmptyState title="No such automation" />;

  const stepTypes = meta.data?.steps || [];
  const publishedBehind = automation.version > 0 && dirty;

  return (
    <div>
      <PageHeader
        breadcrumbs={<Link to="/automations">← Automations</Link>}
        title={
          <span className="au__name">
            <span className="au__name-icon">{draft.icon || '⚡'}</span>
            {draft.name || 'Untitled'}
          </span>
        }
        description={
          <span className="row-wrap" style={{ gap: 6 }}>
            <Badge tone={automation.status === 'published' ? 'success' : automation.status === 'archived' ? 'warning' : 'neutral'}>{automation.status}</Badge>
            {automation.version > 0 ? <Badge tone="info">v{automation.version} published</Badge> : <Badge>never published</Badge>}
            <span className="muted">{describeTrigger(draft.trigger)} · {(draft.steps || []).length} step{(draft.steps || []).length === 1 ? '' : 's'}</span>
            {dirty && <Badge tone="warning">unsaved changes</Badge>}
          </span>
        }
        actions={
          <>
            <Button onClick={() => detail.reload()} disabled={saving}>Reload</Button>
            <Button variant="primary" onClick={save} loading={saving} disabled={!dirty}>Save draft</Button>
          </>
        }
      />

      <div className="au__stats">
        <Stat label="Businesses" value={stats.installs ?? 0} />
        <Stat label="Switched on" value={stats.enabled ?? 0} />
        <Stat label="On latest" value={stats.current ?? 0} tone="success" />
        <Stat label="Behind" value={stats.behind ?? 0} tone={stats.behind ? 'warning' : 'neutral'} />
      </div>

      {detail.data?.problems?.length > 0 && (
        <>
          <Notice tone="warning" title="This draft cannot be published yet">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {detail.data.problems.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </Notice>
          <div className="au__gap" />
        </>
      )}

      <TabBar tabs={TABS} activeId={tab} onChange={setTab} />
      <div className="au__gap" />

      {tab === 'build' && (
        <BuildTab draft={draft} patch={patch} meta={meta.data} stepTypes={stepTypes} />
      )}
      {tab === 'settings' && <SettingsTab draft={draft} patch={patch} meta={meta.data} />}
      {tab === 'test' && <TestTab id={id} dirty={dirty} onSaveFirst={save} />}
      {tab === 'push' && (
        <PushTab
          id={id}
          automation={automation}
          versions={detail.data?.versions || []}
          deployments={detail.data?.deployments || []}
          meta={meta.data}
          dirty={dirty}
          problems={detail.data?.problems || []}
          onChanged={detail.reload}
          confirm={confirm}
        />
      )}
      {tab === 'installs' && <InstallsTab id={id} automation={automation} confirm={confirm} onChanged={detail.reload} />}
      {tab === 'versions' && <VersionsTab versions={detail.data?.versions || []} automation={automation} />}
      {tab === 'runs' && <RunsTab runs={detail.data?.runs || []} onRefresh={detail.reload} />}

      {publishedBehind && tab !== 'push' && (
        <p className="au__hint">Changes here stay in the draft. Businesses keep running v{automation.version} until you publish and push again.</p>
      )}
      {confirmElement}
    </div>
  );
}

/* ── Build ───────────────────────────────────────────────────────────── */

function BuildTab({ draft, patch, meta, stepTypes }) {
  const [palette, setPalette] = useState(false);
  const steps = draft.steps || [];

  const setSteps = (next) => patch({ steps: next });
  const updateStep = (i, changes) => setSteps(steps.map((s, j) => (j === i ? { ...s, ...changes } : s)));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
  };
  const addStep = (type) => {
    const def = stepTypes.find((s) => s.type === type);
    const config = {};
    for (const f of def?.fields || []) if (f.default !== undefined) config[f.key] = f.default;
    setSteps([...steps, { id: newStepId(type, steps), type, name: def?.label || type, config, enabled: true }]);
    setPalette(false);
  };

  return (
    <div className="stack">
      <Card title="Identity" subtitle="What businesses see on their dashboard">
        <div className="au__step-grid">
          <Field field={{ name: 'name', label: 'Name', type: 'text', required: true }} value={draft.name} onChange={(v) => patch({ name: v })} />
          <Field field={{ name: 'key', label: 'Key', type: 'text', help: 'Stable handle; lowercase, hyphens.' }} value={draft.key} onChange={(v) => patch({ key: v })} />
          <Field field={{ name: 'icon', label: 'Icon', type: 'text', placeholder: '⚡' }} value={draft.icon} onChange={(v) => patch({ icon: v })} />
          <Field field={{ name: 'category', label: 'Category', type: 'text' }} value={draft.category} onChange={(v) => patch({ category: v })} />
          <Field
            field={{ name: 'kind', label: 'Kind', type: 'select', options: [{ value: 'automation', label: 'Automation' }, { value: 'script', label: 'Script' }] }}
            value={draft.kind}
            onChange={(v) => patch({ kind: v || 'automation' })}
          />
          <Field field={{ name: 'description', label: 'What it does', type: 'textarea', rows: 2, span: 'full' }} value={draft.description} onChange={(v) => patch({ description: v })} />
        </div>
      </Card>

      <Card title="Trigger" subtitle="What starts a run">
        <TriggerEditor trigger={draft.trigger || { type: 'manual' }} onChange={(trigger) => patch({ trigger })} meta={meta} />
      </Card>

      <Card
        title="Steps"
        subtitle="Run in order. Each step's output is available to the ones after it as {{ steps.<id>.… }}"
        actions={<Button variant="primary" onClick={() => setPalette(true)} disabled={!stepTypes.length}>Add step</Button>}
      >
        {steps.length === 0 ? (
          <EmptyState
            icon="🧱"
            title="No steps yet"
            description="Add the first one from the palette — read some data, check a condition, send a text, call a URL, run a script."
            action={<Button variant="primary" onClick={() => setPalette(true)}>Add step</Button>}
          />
        ) : (
          <div className="au__steps">
            {steps.map((step, i) => (
              <StepCard
                key={`${step.id}-${i}`}
                index={i}
                step={step}
                def={stepTypes.find((s) => s.type === step.type)}
                onChange={(changes) => updateStep(i, changes)}
                onMove={(dir) => move(i, dir)}
                onRemove={() => setSteps(steps.filter((_, j) => j !== i))}
                canUp={i > 0}
                canDown={i < steps.length - 1}
              />
            ))}
          </div>
        )}
        <p className="au__hint">
          Templates: <code>{'{{ business.name }}'}</code> <code>{'{{ business.phone }}'}</code>{' '}
          <code>{'{{ config.<setting> }}'}</code> <code>{'{{ trigger.payload.<field> }}'}</code>{' '}
          <code>{'{{ steps.<id>.rows.0.<column> }}'}</code> <code>{'{{ now }}'}</code>
        </p>
      </Card>

      {palette && (
        <Modal open title="Add a step" onClose={() => setPalette(false)} size="lg">
          <StepPalette stepTypes={stepTypes} onPick={addStep} />
        </Modal>
      )}
    </div>
  );
}

function TriggerEditor({ trigger, onChange, meta }) {
  const set = (changes) => onChange({ ...trigger, ...changes });
  const types = meta?.triggers || [];
  const events = meta?.events || [];
  const timezones = meta?.timezones || ['America/Chicago'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="au__step-grid">
      <Field
        field={{ name: 'type', label: 'Fires', type: 'select', options: types.map((t) => ({ value: t.type, label: t.label })), span: 'full' }}
        value={trigger.type}
        onChange={(v) => onChange({ type: v || 'manual' })}
      />
      {types.find((t) => t.type === trigger.type)?.description && (
        <p className="au__hint" style={{ gridColumn: '1 / -1', marginTop: -8 }}>{types.find((t) => t.type === trigger.type).description}</p>
      )}
      {trigger.type === 'schedule' && (
        <>
          <Field
            field={{ name: 'every', label: 'How often', type: 'select', options: [{ value: 'hour', label: 'Every hour' }, { value: 'day', label: 'Every day' }, { value: 'week', label: 'Every week' }] }}
            value={trigger.every || 'day'}
            onChange={(v) => set({ every: v || 'day' })}
          />
          {(trigger.every || 'day') !== 'hour' && (
            <Field field={{ name: 'at', label: 'At (hour)', type: 'time', help: 'Checked once an hour — minutes are ignored.' }} value={trigger.at || '09:00'} onChange={(v) => set({ at: v })} />
          )}
          {trigger.every === 'week' && (
            <Field
              field={{ name: 'day_of_week', label: 'On', type: 'select', options: DAYS.map((d, i) => ({ value: String(i), label: d })) }}
              value={String(trigger.day_of_week ?? 1)}
              onChange={(v) => set({ day_of_week: Number(v ?? 1) })}
            />
          )}
          <Field
            field={{ name: 'timezone', label: 'Time zone', type: 'select', options: timezones }}
            value={trigger.timezone || 'America/Chicago'}
            onChange={(v) => set({ timezone: v || 'America/Chicago' })}
          />
        </>
      )}
      {trigger.type === 'event' && (
        <Field
          field={{ name: 'event', label: 'Event', type: 'select', options: events.map((e) => ({ value: e.name, label: `${e.name} — ${e.description}` })), span: 'full' }}
          value={trigger.event || ''}
          onChange={(v) => set({ event: v })}
        />
      )}
      {trigger.type === 'webhook' && (
        <p className="au__hint" style={{ gridColumn: '1 / -1' }}>
          Each business gets its own URL on its dashboard. Whatever is POSTed to it is <code>{'{{ trigger.payload }}'}</code>.
        </p>
      )}
    </div>
  );
}

function StepPalette({ stepTypes, onPick }) {
  const groups = useMemo(() => {
    const byCat = new Map();
    for (const s of stepTypes) {
      if (!byCat.has(s.category)) byCat.set(s.category, []);
      byCat.get(s.category).push(s);
    }
    return [...byCat.entries()];
  }, [stepTypes]);

  return (
    <div className="au__palette">
      {groups.map(([cat, items]) => (
        <div key={cat}>
          <p className="au__palette-cat">{cat}</p>
          <div className="au__palette-grid">
            {items.map((s) => (
              <button type="button" className="au__palette-item" key={s.type} onClick={() => onPick(s.type)}>
                <span className="au__step-icon">{s.icon}</span>
                <span>
                  <b>{s.label}</b>
                  <span>{s.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StepCard({ index, step, def, onChange, onMove, onRemove, canUp, canDown }) {
  const [open, setOpen] = useState(index === 0 || !Object.keys(step.config || {}).length);
  const setConfig = (key, value) => onChange({ config: { ...step.config, [key]: value } });

  return (
    <div className="au__step" data-disabled={String(step.enabled === false)}>
      <div className="au__step-head" onClick={() => setOpen((v) => !v)} role="button" tabIndex={0}>
        <span className="au__step-num">{index + 1}</span>
        <span className="au__step-icon">{def?.icon || '▫️'}</span>
        <div className="au__step-title">
          <b>{step.name || def?.label || step.type}</b>
          <span className="mono">{step.type} · id {step.id}{step.enabled === false && ' · off'}</span>
        </div>
        <div className="au__step-tools" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => onMove(-1)} disabled={!canUp} aria-label="Move up">↑</Button>
          <Button size="sm" variant="ghost" onClick={() => onMove(1)} disabled={!canDown} aria-label="Move down">↓</Button>
          <Button size="sm" variant="ghost" onClick={onRemove} aria-label="Remove step">✕</Button>
        </div>
      </div>
      {open && (
        <div className="au__step-body">
          {!def && <Notice tone="warning">Unknown step type <code>{step.type}</code> — the API no longer offers it.</Notice>}
          <div className="au__step-grid">
            <Field field={{ name: 'name', label: 'Step name', type: 'text' }} value={step.name} onChange={(v) => onChange({ name: v })} />
            <Field field={{ name: 'id', label: 'Step id', type: 'text', help: 'How later steps refer to this one.' }} value={step.id} onChange={(v) => onChange({ id: String(v || '').replace(/[^a-z0-9_]/gi, '_') })} />
            {(def?.fields || []).map((f) => {
              const value = step.config?.[f.key];
              const problem = isJsonField(f) ? jsonProblem(value) : null;
              return (
                <Field
                  key={f.key}
                  field={controlFor(f)}
                  value={value ?? ''}
                  error={problem}
                  onChange={(v) => setConfig(f.key, v)}
                />
              );
            })}
            <Field field={{ name: 'enabled', label: 'Enabled', type: 'boolean' }} value={step.enabled !== false} onChange={(v) => onChange({ enabled: v })} />
            <Field field={{ name: 'continue_on_error', label: 'If it fails', type: 'boolean', checkboxLabel: step.continue_on_error ? 'carry on' : 'stop the run' }} value={!!step.continue_on_error} onChange={(v) => onChange({ continue_on_error: v })} />
          </div>
          {def?.side_effect && <p className="au__hint">Has side effects — a test run reports what it would do instead of doing it.</p>}
        </div>
      )}
    </div>
  );
}

/* ── Settings ────────────────────────────────────────────────────────── */

function SettingsTab({ draft, patch, meta }) {
  const schema = draft.config_schema || [];
  const types = meta?.config_field_types || ['text', 'textarea', 'number', 'boolean', 'select', 'tel', 'email'];
  const setRows = (next) => patch({ config_schema: next });
  const update = (i, changes) => setRows(schema.map((f, j) => (j === i ? { ...f, ...changes } : f)));

  return (
    <Card
      title="Settings a business fills in"
      subtitle="Each one becomes a field on their dashboard, and {{ config.<key> }} in your steps"
      actions={<Button variant="primary" onClick={() => setRows([...schema, { key: `setting_${schema.length + 1}`, label: '', type: 'text', default: '', required: false }])}>Add setting</Button>}
    >
      {schema.length === 0 && (
        <EmptyState icon="🎛️" title="No settings" description="Fine for most automations. Add one when a business needs to supply something — a phone number to text, a threshold, a yes/no." />
      )}
      {schema.map((f, i) => (
        <div className="au__setting" key={i}>
          <Field field={{ name: 'key', label: 'Key', type: 'text' }} value={f.key} onChange={(v) => update(i, { key: String(v || '').toLowerCase().replace(/[^a-z0-9_]/g, '_') })} />
          <Field field={{ name: 'label', label: 'Label', type: 'text' }} value={f.label} onChange={(v) => update(i, { label: v })} />
          <Field field={{ name: 'type', label: 'Type', type: 'select', options: types }} value={f.type || 'text'} onChange={(v) => update(i, { type: v || 'text' })} />
          {f.type === 'select'
            ? <Field field={{ name: 'options', label: 'Options', type: 'tags', placeholder: 'a, b, c' }} value={f.options || []} onChange={(v) => update(i, { options: v })} />
            : f.type === 'boolean'
              ? <Field field={{ name: 'default', label: 'Default', type: 'boolean' }} value={!!f.default} onChange={(v) => update(i, { default: v })} />
              : <Field field={{ name: 'default', label: 'Default', type: 'text' }} value={f.default ?? ''} onChange={(v) => update(i, { default: v })} />}
          <Button variant="ghost" size="sm" onClick={() => setRows(schema.filter((_, j) => j !== i))} aria-label="Remove setting">✕</Button>
          <Field field={{ name: 'help', label: 'Help text', type: 'text', span: 'full' }} value={f.help || ''} onChange={(v) => update(i, { help: v })} />
        </div>
      ))}
    </Card>
  );
}

/* ── Test ────────────────────────────────────────────────────────────── */

function TestTab({ id, dirty, onSaveFirst }) {
  const toast = useToast();
  const [slug, setSlug] = useState(null);
  const [input, setInput] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!slug) return toast.warning('Pick a business first.');
    let payload = null;
    if (input.trim()) {
      try { payload = JSON.parse(input); } catch { return toast.warning('The input is not valid JSON.'); }
    }
    setRunning(true);
    setResult(null);
    try {
      if (dirty) await onSaveFirst();
      const { result: r } = await api.post(endpoints.automations.test(id), { slug, input: payload, dry_run: dryRun });
      setResult(r);
    } catch (err) {
      toast.error(err);
      if (err.body?.problems) setResult({ status: 'failed', error: err.body.problems.join(' '), steps_log: [] });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="stack">
      <Card title="Try the draft" subtitle="Runs against one business's real data. Reads happen; writes, texts, emails and AI calls are reported, not done — unless you switch dry run off.">
        <div className="au__step-grid">
          <div style={{ gridColumn: '1 / -1' }}>
            <EntityPicker value={slug} onChange={setSlug} label="Business to test against" />
          </div>
          <Field field={{ name: 'input', label: 'Trigger payload (JSON, optional)', type: 'json', rows: 4, span: 'full', help: 'Available as {{ trigger.payload.… }}. Stands in for a webhook body or an event.' }} value={input} onChange={setInput} />
          <Field field={{ name: 'dry', label: 'Dry run', type: 'boolean', checkboxLabel: dryRun ? 'side effects off' : 'FOR REAL — texts and writes happen' }} value={dryRun} onChange={setDryRun} />
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <Button variant={dryRun ? 'primary' : 'danger'} onClick={run} loading={running} disabled={!slug}>
              {dryRun ? 'Run test' : 'Run for real'}
            </Button>
          </div>
        </div>
        {dirty && <p className="au__hint">Unsaved changes will be saved first, so the test runs what you see.</p>}
      </Card>

      {result && (
        <Card title={<span className="au__name"><RunStatus status={result.status} /> Result</span>} subtitle={result.error || `${result.duration_ms} ms`}>
          <RunSteps steps={result.steps_log} output={result.output} />
        </Card>
      )}
    </div>
  );
}

/* ── Publish & push ──────────────────────────────────────────────────── */

function PushTab({ id, automation, versions, deployments, meta, dirty, problems, onChanged, confirm }) {
  const toast = useToast();
  const [changelog, setChangelog] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [audience, setAudience] = useState({ mode: 'owners', industries: [], slugs: [] });
  const [version, setVersion] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [pushing, setPushing] = useState(false);

  const publish = async () => {
    setPublishing(true);
    try {
      const r = await api.post(endpoints.automations.publish(id), { changelog });
      toast.success(`Published v${r.version}`);
      setChangelog('');
      onChanged();
    } catch (err) {
      toast.error(err.body?.problems?.[0] || err);
    } finally {
      setPublishing(false);
    }
  };

  const doPreview = async () => {
    setPreviewing(true);
    try {
      setPreview(await api.post(endpoints.automations.deployPreview(id), { audience }));
    } catch (err) {
      toast.error(err);
    } finally {
      setPreviewing(false);
    }
  };

  const push = async () => {
    const target = preview?.targeted ?? '?';
    const ok = await confirm({
      title: `Push v${version || automation.version} to ${target} business${target === 1 ? '' : 'es'}?`,
      message: `${describeAudience(audience)}. Existing installs move to this version and keep their settings; new ones are ${enabled ? 'switched on' : 'installed switched off'}.`,
      confirmLabel: 'Push',
      tone: 'primary',
    });
    if (!ok) return;
    setPushing(true);
    try {
      const { deployment } = await api.post(endpoints.automations.deploy(id), {
        audience, version: version ? Number(version) : undefined, enabled, notes,
      });
      toast.success(`${deployment.installed} new, ${deployment.updated} updated${deployment.failed ? `, ${deployment.failed} failed` : ''}`, 'Pushed');
      setPreview(null);
      setNotes('');
      onChanged();
    } catch (err) {
      toast.error(err);
    } finally {
      setPushing(false);
    }
  };

  const industries = meta?.industries || [];
  const canPublish = !problems.length && !dirty && automation.status !== 'archived';

  return (
    <div className="stack">
      <Card title="1. Publish a version" subtitle={automation.version ? `Latest is v${automation.version}. Publishing snapshots the draft as v${automation.version + 1}.` : 'Nothing published yet. Publishing snapshots the draft as v1.'}>
        {dirty && <Notice tone="warning">Save the draft first — publishing snapshots what is saved.</Notice>}
        {problems.length > 0 && <Notice tone="warning">Fix the problems listed at the top before publishing.</Notice>}
        <div className="au__gap" />
        <div className="au__step-grid">
          <Field field={{ name: 'changelog', label: 'What changed', type: 'textarea', rows: 2, span: 'full', placeholder: 'Optional — shown in the version list.' }} value={changelog} onChange={setChangelog} />
        </div>
        <Button variant="primary" onClick={publish} loading={publishing} disabled={!canPublish}>Publish v{(automation.version || 0) + 1}</Button>
      </Card>

      <Card title="2. Push it to businesses" subtitle="This is the update. Each targeted business moves to the chosen version.">
        {!automation.version && <Notice tone="info">Publish a version first.</Notice>}
        <div className="au__step-grid">
          <div className="au__audience" style={{ gridColumn: '1 / -1' }}>
            {[
              ['owners', 'Businesses with a login', 'Everyone who can open a dashboard. The usual choice.'],
              ['industries', 'Certain industries', 'Every active business of the types you pick.'],
              ['slugs', 'Named businesses', 'A hand-picked list — for a pilot, or a fix for one.'],
              ['all', 'Every active listing', 'Thousands of businesses, most without a login yet. Installs sit ready for when they sign up. Careful with scheduled texts.'],
            ].map(([mode, label, help]) => (
              <label className="au__radio" key={mode}>
                <input type="radio" name="audience" checked={audience.mode === mode} onChange={() => { setAudience({ ...audience, mode }); setPreview(null); }} />
                <span><b>{label}</b><span>{help}</span></span>
              </label>
            ))}
          </div>
          {audience.mode === 'industries' && (
            <Field
              field={{ name: 'industries', label: 'Industries', type: 'multiselect', span: 'full', options: industries.map((i) => ({ value: i.value, label: `${i.value} (${i.count})` })) }}
              value={audience.industries}
              onChange={(v) => { setAudience({ ...audience, industries: v }); setPreview(null); }}
            />
          )}
          {audience.mode === 'slugs' && (
            <Field field={{ name: 'slugs', label: 'Business slugs', type: 'tags', span: 'full', placeholder: 'flora-bama, the-wharf, …' }} value={audience.slugs} onChange={(v) => { setAudience({ ...audience, slugs: v }); setPreview(null); }} />
          )}
          <Field
            field={{ name: 'version', label: 'Version', type: 'select', options: versions.map((v) => ({ value: String(v.version), label: `v${v.version}${v.version === automation.version ? ' (latest)' : ''}` })), placeholder: `latest (v${automation.version})` }}
            value={version}
            onChange={(v) => setVersion(v || '')}
          />
          <Field field={{ name: 'enabled', label: 'New installs start', type: 'boolean', checkboxLabel: enabled ? 'switched on' : 'switched off' }} value={enabled} onChange={setEnabled} />
          <Field field={{ name: 'notes', label: 'Notes', type: 'text', span: 'full', placeholder: 'Optional — shown in the rollout ledger.' }} value={notes} onChange={setNotes} />
        </div>
        <div className="au__gap" />
        <div className="row-wrap" style={{ gap: 8, alignItems: 'center' }}>
          <Button onClick={doPreview} loading={previewing} disabled={!automation.version}>Preview audience</Button>
          <Button variant="primary" onClick={push} loading={pushing} disabled={!automation.version || !preview}>Push</Button>
          {!preview && automation.version > 0 && <span className="muted">Preview first, so you see the count before it goes.</span>}
        </div>
        {preview && (
          <>
            <div className="au__gap" />
            <div className="au__preview">
              <b>{preview.targeted}</b> business{preview.targeted === 1 ? '' : 'es'} targeted · <b>{preview.already_installed}</b> already have it (they move to this version) ·{' '}
              <b>{preview.targeted - preview.already_installed}</b> new
              {preview.sample?.length > 0 && <div className="mono muted" style={{ marginTop: 6, fontSize: 12 }}>{preview.sample.join(' · ')}{preview.targeted > preview.sample.length ? ' · …' : ''}</div>}
            </div>
          </>
        )}
      </Card>

      <Card title="Pushes so far" subtitle="newest first">
        {deployments.length
          ? (
            <DataTable
              columns={[
                { key: 'created_at', header: 'When', render: (d) => formatDateTime(d.created_at) },
                { key: 'version', header: 'Version', render: (d) => <Badge tone="info">v{d.version}</Badge> },
                { key: 'audience', header: 'To', render: (d) => describeAudience(d.audience) },
                { key: 'targeted', header: 'Targeted', align: 'right' },
                { key: 'installed', header: 'New', align: 'right' },
                { key: 'updated', header: 'Updated', align: 'right' },
                { key: 'failed', header: 'Failed', align: 'right', render: (d) => (d.failed ? <Badge tone="danger">{d.failed}</Badge> : <span className="faint">0</span>) },
                { key: 'notes', header: 'Notes', render: (d) => d.notes || <span className="faint">—</span> },
              ]}
              rows={deployments}
              pageSize={10}
              searchable={false}
            />
          )
          : <EmptyState icon="🚀" title="Never pushed" />}
      </Card>
    </div>
  );
}

/* ── Installs ────────────────────────────────────────────────────────── */

function InstallsTab({ id, automation, confirm, onChanged }) {
  const toast = useToast();
  const query = useAsync(async () => api.get(endpoints.automations.installs(id)), [id], { initialData: null });
  const rows = query.data?.installs || [];
  const [running, setRunning] = useState(null);
  const [lastRun, setLastRun] = useState(null);

  const setEnabled = async (row, enabled) => {
    try {
      await api.patch(endpoints.automations.install(id, row.entity_slug), { enabled });
      query.reload();
      onChanged();
    } catch (err) { toast.error(err); }
  };
  const moveToLatest = async (row) => {
    try {
      await api.patch(endpoints.automations.install(id, row.entity_slug), { version: automation.version });
      toast.success(`${row.entity_name || row.entity_slug} is on v${automation.version}`);
      query.reload();
      onChanged();
    } catch (err) { toast.error(err); }
  };
  const runNow = async (row) => {
    setRunning(row.entity_slug);
    try {
      const { result } = await api.post(endpoints.automations.run(id), { slug: row.entity_slug });
      setLastRun({ slug: row.entity_slug, result });
      toast[result.status === 'ok' ? 'success' : 'warning'](`${row.entity_slug}: ${result.status}${result.error ? ` — ${result.error}` : ''}`, 'Ran');
      query.reload();
    } catch (err) { toast.error(err); } finally { setRunning(null); }
  };
  const uninstall = async (row) => {
    const ok = await confirm({ title: `Remove from ${row.entity_name || row.entity_slug}?`, message: 'Their settings for it are lost. You can push it again later.', confirmLabel: 'Remove' });
    if (!ok) return;
    try {
      await api.del(endpoints.automations.install(id, row.entity_slug));
      query.reload();
      onChanged();
    } catch (err) { toast.error(err); }
  };

  const columns = [
    {
      key: 'entity_name',
      header: 'Business',
      searchable: true,
      sortable: true,
      render: (r) => (
        <div>
          <Link to={`/directory/profile/${r.entity_slug}`}>{r.entity_name || r.entity_slug}</Link>
          <div className="au__name-sub mono">{r.entity_slug}{r.entity_type ? ` · ${r.entity_type}` : ''}</div>
        </div>
      ),
    },
    {
      key: 'version',
      header: 'Version',
      sortable: true,
      render: (r) => r.version === automation.version
        ? <Badge tone="success">v{r.version}</Badge>
        : <span className="row-wrap" style={{ gap: 4 }}><Badge tone="warning">v{r.version}</Badge><Button size="sm" variant="link" onClick={() => moveToLatest(r)}>→ v{automation.version}</Button></span>,
    },
    { key: 'enabled', header: 'On', render: (r) => <Badge tone={r.enabled ? 'success' : 'neutral'}>{r.enabled ? 'on' : 'off'}</Badge>, sortable: true },
    { key: 'config', header: 'Settings', render: (r) => (Object.keys(r.config || {}).length ? <span className="mono muted" style={{ fontSize: 12 }}>{JSON.stringify(r.config)}</span> : <span className="faint">defaults</span>), searchable: false },
    {
      key: 'last_run_at',
      header: 'Last run',
      sortable: true,
      render: (r) => r.last_run_at ? <span className="row-wrap" style={{ gap: 4 }}><RunStatus status={r.last_run_status} /><span className="muted">{formatDateTime(r.last_run_at)}</span></span> : <span className="faint">never</span>,
    },
    {
      key: '__act',
      header: '',
      align: 'right',
      render: (r) => (
        <span className="row-wrap" style={{ gap: 4, justifyContent: 'flex-end' }}>
          <Button size="sm" variant="ghost" onClick={() => setEnabled(r, !r.enabled)}>{r.enabled ? 'Switch off' : 'Switch on'}</Button>
          <Button size="sm" variant="ghost" onClick={() => runNow(r)} loading={running === r.entity_slug}>Run now</Button>
          <Button size="sm" variant="ghost" onClick={() => uninstall(r)}>Remove</Button>
        </span>
      ),
    },
  ];

  return (
    <div className="stack">
      <Card title="Installed on" subtitle={`${rows.length} business${rows.length === 1 ? '' : 'es'}`} actions={<Button onClick={() => query.reload()}>Refresh</Button>}>
        {query.loading && <LoadingBlock label="Loading installs…" />}
        {query.error && <ErrorState error={query.error} onRetry={query.reload} context="installs" />}
        {!query.loading && !query.error && (
          rows.length
            ? <DataTable columns={columns} rows={rows} pageSize={25} searchable searchPlaceholder="Search businesses…" initialSort={{ key: 'entity_name', direction: 'asc' }} />
            : <EmptyState icon="🏢" title="Not installed anywhere" description="Push a version from the Publish & push tab." />
        )}
      </Card>
      {lastRun && (
        <Card title={<span className="au__name"><RunStatus status={lastRun.result.status} /> {lastRun.slug}</span>} subtitle={lastRun.result.error || `${lastRun.result.duration_ms} ms`}>
          <RunSteps steps={lastRun.result.steps_log} output={lastRun.result.output} />
        </Card>
      )}
    </div>
  );
}

/* ── Versions ────────────────────────────────────────────────────────── */

function VersionsTab({ versions, automation }) {
  return (
    <Card title="Published versions" subtitle="Each is a frozen snapshot. Businesses run the one they were pushed.">
      {versions.length
        ? (
          <DataTable
            columns={[
              { key: 'version', header: 'Version', render: (v) => <Badge tone={v.version === automation.version ? 'success' : 'neutral'}>v{v.version}{v.version === automation.version ? ' · latest' : ''}</Badge> },
              { key: 'published_at', header: 'Published', render: (v) => formatDateTime(v.published_at) },
              { key: 'changelog', header: 'What changed', render: (v) => v.changelog || <span className="faint">—</span> },
            ]}
            rows={versions}
            pageSize={20}
            searchable={false}
          />
        )
        : <EmptyState icon="🗂️" title="Nothing published yet" />}
    </Card>
  );
}

/* ── Runs ────────────────────────────────────────────────────────────── */

function RunsTab({ runs, onRefresh }) {
  return (
    <Card title="Recent runs" subtitle="the last 50 for this automation, across every business" actions={<Button onClick={onRefresh}>Refresh</Button>}>
      {runs.length
        ? <div className="au__steps">{runs.map((r) => <RunRow key={r.id} run={r} />)}</div>
        : <EmptyState icon="🧾" title="No runs yet" description="Test it, run it for a business from Installs, or wait for its trigger." />}
    </Card>
  );
}
