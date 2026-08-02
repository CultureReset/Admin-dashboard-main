/**
 * AI config — which provider and model handles each task.
 *
 * GET /api/admin/ai-config      → { configs: [...], providers: {...} }
 * PUT /api/admin/ai-config/:task { provider, model, is_active, notes }
 *
 * The provider list comes from the API's own PROVIDERS constant, so the model
 * options here are whatever the backend actually supports rather than a list
 * typed into the dashboard.
 */

import { useMemo, useState } from 'react';
import { Badge, Button, Card, ErrorState, LoadingBlock, PageHeader } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, fields } from '../../lib/fields.jsx';

export default function AiConfig() {
  const toast = useToast();
  const [editing, setEditing] = useState(null);

  const { data, loading, error, reload } = useAsync(
    async () => api.get(endpoints.ai.config()),
    [],
    { initialData: null },
  );

  // Guard the shape — an unexpected payload shows an empty table, not a crash.
  const configs = Array.isArray(data?.configs) ? data.configs : [];
  const providers = data?.providers || {};

  const providerOptions = useMemo(() => Object.keys(providers), [providers]);

  /** Model list narrows to the selected provider's models. */
  const schema = useMemo(
    () => [
      fields.select('provider', 'Provider', providerOptions, {
        required: true,
        help: 'Providers the API is configured for.',
      }),
      {
        name: 'model',
        label: 'Model',
        type: 'select',
        required: true,
        options: (values) => values,
        // Rebuilt below via a custom render so it can react to `provider`.
      },
      fields.bool('is_active', 'Active', { defaultValue: true }),
      fields.textarea('notes', 'Notes', { rows: 3 }),
    ],
    [providerOptions],
  );

  // The model options depend on the chosen provider, which SchemaForm's static
  // `options` cannot express — a custom control keeps them in step.
  const dynamicSchema = useMemo(
    () =>
      schema.map((field) =>
        field.name === 'model'
          ? {
              ...field,
              type: 'custom',
              render: ({ value, onChange, disabled, field: f }) => (
                <ModelSelect
                  value={value}
                  onChange={onChange}
                  disabled={disabled}
                  providers={providers}
                  providerOf={editing?.provider}
                  label={f.label}
                />
              ),
            }
          : field,
      ),
    [schema, providers, editing],
  );

  const save = async (values) => {
    await api.put(endpoints.ai.configTask(editing.task), values);
    toast.success(`${editing.task} updated.`);
    setEditing(null);
    await reload();
  };

  return (
    <>
      <PageHeader
        title="AI config"
        description="Which model answers each kind of request. Read from the API's own provider registry."
        actions={<Button onClick={reload} disabled={loading}>Refresh</Button>}
      />

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <LoadingBlock />}

      {!loading && !error && (
        <>
          <Card padded={false} title="Tasks">
            <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
              <DataTable
                columns={[
                  {
                    key: 'task',
                    header: 'Task',
                    render: (row) => <span className="ui-cell-primary mono">{row.task}</span>,
                  },
                  columns.text('provider', 'Provider'),
                  {
                    key: 'model',
                    header: 'Model',
                    render: (row) => <span className="mono">{row.model}</span>,
                  },
                  columns.bool('is_active', 'Active'),
                  columns.text('notes', 'Notes'),
                  {
                    key: '__actions',
                    header: '',
                    align: 'right',
                    sortable: false,
                    searchable: false,
                    stopPropagation: true,
                    render: (row) => (
                      <Button size="sm" onClick={() => setEditing(row)}>Edit</Button>
                    ),
                  },
                ]}
                rows={configs}
                rowKey="task"
                searchPlaceholder="Search tasks…"
                emptyTitle="No AI tasks configured"
              />
            </div>
          </Card>

          <div style={{ height: 'var(--space-5)' }} />

          <Card title="Available providers" subtitle="Reported by the API.">
            <div className="grid-auto">
              {providerOptions.map((provider) => (
                <div key={provider} className="ui-stat">
                  <div className="row-wrap" style={{ marginBottom: 8 }}>
                    <strong>{provider}</strong>
                    <Badge>{(providers[provider]?.models || providers[provider] || []).length} models</Badge>
                  </div>
                  <div className="row-wrap" style={{ gap: 4 }}>
                    {(providers[provider]?.models || providers[provider] || [])
                      .slice(0, 6)
                      .map((model) => (
                        <Badge key={model}>{model}</Badge>
                      ))}
                  </div>
                </div>
              ))}
              {providerOptions.length === 0 && (
                <p className="muted">The API did not report any providers.</p>
              )}
            </div>
          </Card>
        </>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Configure “${editing.task}”` : ''}
      >
        {editing && (
          <SchemaForm
            schema={dynamicSchema}
            initialValues={editing}
            columns={1}
            onSubmit={save}
            onCancel={() => setEditing(null)}
            submitLabel="Save configuration"
          />
        )}
      </Modal>
    </>
  );
}

/** Model picker that lists only the selected provider's models. */
function ModelSelect({ value, onChange, disabled, providers, providerOf }) {
  const models = useMemo(() => {
    const entry = providers?.[providerOf];
    if (!entry) return [];
    return Array.isArray(entry) ? entry : entry.models || [];
  }, [providers, providerOf]);

  return (
    <>
      <input
        className="ui-input"
        list="ai-model-options"
        value={value ?? ''}
        disabled={disabled}
        placeholder="Model identifier"
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id="ai-model-options">
        {models.map((model) => (
          <option key={model} value={model} />
        ))}
      </datalist>
    </>
  );
}
