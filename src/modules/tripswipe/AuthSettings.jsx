/**
 * Tourist auth settings.
 *
 * The legacy dashboard used /api/admin/auth-config, which is absent from
 * gcr-api-clean. The screen is wired to that path and reports the gap.
 *
 * What does exist today: /api/tourist-auth handles the sign-in flows
 * themselves, and middleware/auth.js accepts GCR Supabase JWTs for tourists.
 */

import { PageHeader, Notice } from '../../ui/primitives.jsx';
import { ConfigCard } from '../../components/ConfigCard.jsx';
import { endpoints } from '../../api/endpoints.js';
import { fields } from '../../lib/fields.jsx';

const schema = {
  groups: [
    {
      title: 'Sign-in methods',
      fields: [
        fields.bool('email_enabled', 'Email + password'),
        fields.bool('magic_link_enabled', 'Magic link'),
        fields.bool('sms_enabled', 'SMS code'),
        fields.bool('google_enabled', 'Google'),
        fields.bool('apple_enabled', 'Apple'),
        fields.bool('facebook_enabled', 'Facebook'),
        fields.bool('guest_enabled', 'Continue as guest'),
      ],
    },
    {
      title: 'Behaviour',
      fields: [
        fields.bool('require_verification', 'Require verification before use'),
        fields.number('session_days', 'Session length (days)', { min: 1, step: 1 }),
        fields.url('after_login_url', 'Redirect after sign-in', { span: 2 }),
      ],
    },
  ],
};

export default function AuthSettings() {
  return (
    <>
      <PageHeader
        title="Auth settings"
        description="Which sign-in methods the tourist app offers."
      />

      <Notice tone="info" title="Where auth actually lives">
        Sign-in itself is handled by <code className="mono">/api/tourist-auth</code> and by the
        GCR Supabase project. This screen is only for the toggles that decide which methods appear.
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <ConfigCard
        title="Sign-in configuration"
        schema={schema}
        getPath={() => endpoints.settings.get(endpoints.settingsKeys.authConfig)}
        responseKeys={['value']}
      />
    </>
  );
}
