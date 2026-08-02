/**
 * SMS provider settings.
 *
 * /api/admin/sms-config is called by the legacy dashboard but is not in
 * gcr-api-clean, so this reports the gap.
 *
 * Sending works today through /api/sms/send and the blast routes, which read
 * their provider credentials from the API's environment.
 */

import { Link } from 'react-router-dom';
import { PageHeader, Notice } from '../../ui/primitives.jsx';
import { ConfigCard } from '../../components/ConfigCard.jsx';
import { endpoints } from '../../api/endpoints.js';
import { fields } from '../../lib/fields.jsx';

const schema = {
  groups: [
    {
      title: 'Provider',
      fields: [
        fields.select('provider', 'Provider', ['brevo', 'twilio', 'none'], {
          help: 'The API reads its own credentials from the environment; this only records the choice.',
        }),
        fields.bool('enabled', 'Sending enabled'),
        fields.text('sender_id', 'Sender ID', { placeholder: 'Shown as the sender' }),
        fields.tel('from_number', 'From number'),
      ],
    },
    {
      title: 'Defaults',
      fields: [
        fields.textarea('signature', 'Message signature', {
          rows: 2,
          help: 'Appended to outgoing messages.',
        }),
        fields.text('opt_out_text', 'Opt-out text', { placeholder: 'Reply STOP to opt out' }),
        fields.number('daily_cap', 'Daily send cap', { min: 0, step: 1 }),
      ],
    },
  ],
};

export default function SmsSettings() {
  return (
    <>
      <PageHeader
        title="SMS settings"
        description="Provider and sending defaults for outbound text messages."
      />

      <Notice tone="info" title="Credentials live on the server">
        The API reads its SMS credentials from environment variables — nothing secret is stored or
        editable from this dashboard. To send messages, use{' '}
        <Link to="/tripswipe/sms-blasts">SMS Blasts</Link>.
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <ConfigCard
        title="SMS configuration"
        schema={schema}
        getPath={() => endpoints.sms.config()}
        responseKeys={['config', 'sms_config']}
      />
    </>
  );
}
