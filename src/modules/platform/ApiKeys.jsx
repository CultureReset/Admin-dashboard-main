/**
 * API keys.
 *
 * The legacy dashboard posted keys to /api/admin/save-api-key. That route does
 * not exist in gcr-api-clean.
 *
 * This screen is deliberately conservative about secrets: it never displays a
 * stored key, it does not fetch one, and the field is write-only. Even once the
 * route exists, an admin dashboard should not be a place where a provider key
 * can be read back off the screen.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Notice, PageHeader } from '../../ui/primitives.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { fields } from '../../lib/fields.jsx';

const PROVIDERS = ['anthropic', 'openai', 'groq', 'xai', 'stripe', 'square', 'brevo', 'resend', 'sendgrid'];

const schema = [
  fields.select('provider', 'Provider', PROVIDERS, { required: true, span: 2 }),
  {
    name: 'api_key',
    label: 'API key',
    type: 'password',
    required: true,
    span: 'full',
    help: 'Sent once and never read back. Paste the full key.',
    autoComplete: 'off',
  },
  fields.text('label', 'Label', { span: 2, placeholder: 'Which account this belongs to' }),
];

export default function ApiKeys() {
  const toast = useToast();
  const [lastSaved, setLastSaved] = useState(null);

  const save = async (values) => {
    await api.post(endpoints.unverified.saveApiKey(), values);
    toast.success(`${values.provider} key saved.`);
    setLastSaved({ provider: values.provider, at: new Date().toLocaleTimeString() });
  };

  return (
    <>
      <PageHeader
        title="API keys"
        description="Provider credentials held by the platform."
      />

      <Notice tone="warning" title="This screen's API route is not deployed">
        <code className="mono">/api/admin/save-api-key</code> is called by the previous dashboard
        but does not exist in <code>gcr-api-clean</code>. Today the API reads its provider keys from
        environment variables — set them in the deployment and redeploy.
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <Card
        title="Store a key"
        subtitle="Write-only. Existing keys are never displayed or fetched by this dashboard."
      >
        <Notice tone="info">
          Keys are sent to the API and not kept in the browser. Nothing on this page reads a stored
          key back, so a shoulder-surfer or a screenshot cannot leak one.
        </Notice>
        <div style={{ height: 'var(--space-4)' }} />
        <SchemaForm schema={schema} onSubmit={save} submitLabel="Save key" />
        {lastSaved && (
          <>
            <div style={{ height: 'var(--space-4)' }} />
            <p className="muted">
              Last submitted: <strong>{lastSaved.provider}</strong> at {lastSaved.at}.
            </p>
          </>
        )}
      </Card>

      <div style={{ height: 'var(--space-5)' }} />

      <Card title="Which providers are configured?">
        <p className="muted">
          The API reports its available AI providers on{' '}
          <code className="mono">/api/ai-provider</code>. See{' '}
          <Link to="/ai/settings">AI Settings</Link> for the live list, and{' '}
          <Link to="/platform/integrations">Integrations</Link> to check which routers respond.
        </p>
      </Card>
    </>
  );
}
