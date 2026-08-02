/**
 * Settings screen: GET a config object, edit it against a schema, PUT it back.
 *
 * Several admin screens are exactly this shape. Declaring them as a schema
 * plus two paths keeps them honest about failure too: when the route is not
 * deployed, this renders an explicit notice showing the path it tried,
 * instead of an empty form that looks editable but saves nowhere.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, ErrorState, LoadingBlock, Notice } from '../ui/primitives.jsx';
import { SchemaForm } from '../ui/SchemaForm.jsx';
import { useToast } from '../ui/Toast.jsx';
import { api, unwrapItem } from '../api/client.js';

export function ConfigCard({
  title,
  subtitle,
  schema,
  /** () => path */
  getPath,
  /** () => path — defaults to getPath */
  savePath,
  method = 'PUT',
  /** Response keys that wrap the config object. */
  responseKeys = [],
  /** Map the loaded payload into form values. */
  toFormValues,
  /** Map form values into the request body. */
  toRequestBody,
  columns = 2,
  submitLabel = 'Save settings',
  children,
  /** Shown above the form when the route is missing. */
  unavailableHint,
  extraActions,
}) {
  const toast = useToast();
  const [values, setValues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.get(getPath());
      const config = unwrapItem(payload, responseKeys) || {};
      setValues(toFormValues ? toFormValues(config, payload) : config);
    } catch (err) {
      setError(err);
      // A missing route still gets an empty form so the shape is visible,
      // but the notice above it makes clear that saving will fail.
      setValues({});
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getPath]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (formValues) => {
    const path = (savePath || getPath)();
    const body = toRequestBody ? toRequestBody(formValues) : formValues;
    const send = method === 'POST' ? api.post : method === 'PATCH' ? api.patch : api.put;
    await send(path, body);
    toast.success('Settings saved.');
    await load();
  };

  return (
    <Card
      title={title}
      subtitle={subtitle}
      actions={
        <>
          {extraActions}
          <Button size="sm" onClick={load} disabled={loading}>Reload</Button>
        </>
      }
    >
      {loading && <LoadingBlock />}

      {!loading && error?.isMissingEndpoint && (
        <>
          <Notice tone="warning" title="This screen's API route is not deployed">
            <p>
              The dashboard is wired to <code className="mono">{error.path}</code>, but
              {' '}<code>gcr-api-clean</code> does not serve it. The form below shows the fields this
              screen expects; saving will fail until the route exists.
            </p>
            {unavailableHint && <p style={{ marginTop: 8 }}>{unavailableHint}</p>}
          </Notice>
          <div style={{ height: 'var(--space-4)' }} />
        </>
      )}

      {!loading && error && !error.isMissingEndpoint && (
        <>
          <ErrorState error={error} onRetry={load} />
          <div style={{ height: 'var(--space-4)' }} />
        </>
      )}

      {!loading && children}

      {!loading && values && (
        <SchemaForm
          schema={schema}
          initialValues={values}
          columns={columns}
          onSubmit={save}
          submitLabel={submitLabel}
        />
      )}
    </Card>
  );
}

export default ConfigCard;
