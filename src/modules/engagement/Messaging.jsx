/**
 * SMS / messaging threads per business.
 *
 * The legacy dashboard called /api/admin/gcr/messaging/:slug. That route does
 * not exist in gcr-api-clean — routes/messaging.js is present but explicitly
 * unmounted in server.js, with a comment saying its backing tables are not in
 * the live database.
 *
 * Rather than hide the screen, it is wired to the path the legacy dashboard
 * used and states plainly why it is not returning anything. The SMS features
 * that do work live under Trip Swipe → SMS Blasts and Text Sign-Up QR Codes.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader } from '../../ui/primitives.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { formatDateTime } from '../../lib/fields.jsx';

export default function Messaging() {
  const [slug, setSlug] = useState(null);

  const { data, loading, error, reload } = useAsync(
    async () => {
      if (!slug) return [];
      return unwrapList(await api.get(endpoints.unverified.messaging(slug)), [
        'conversations',
        'messages',
        'threads',
      ]);
    },
    [slug],
    { initialData: [] },
  );

  const threads = data || [];

  return (
    <>
      <PageHeader
        title="SMS / messaging"
        description="Message threads between a business and its customers."
        actions={<Button onClick={reload} disabled={!slug || loading}>Refresh</Button>}
      />

      <Notice tone="warning" title="This feature's API route is not deployed">
        <p>
          The messaging router exists in <code>gcr-api-clean</code> but is commented out in{' '}
          <code>server.js</code> — its tables are not in the live database. This screen calls the
          same path the previous dashboard used, so it will start working the moment the route is
          mounted.
        </p>
        <p style={{ marginTop: 8 }}>
          The SMS features that <em>are</em> live are{' '}
          <Link to="/tripswipe/sms-blasts">SMS Blasts</Link> and{' '}
          <Link to="/tripswipe/sms-qr">Text Sign-Up QR Codes</Link>.
        </p>
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <Card title="Business">
        <EntityPicker value={slug} onChange={setSlug} label="Show threads for" />
      </Card>

      {slug && (
        <>
          <div style={{ height: 'var(--space-4)' }} />
          <Card title="Threads">
            {loading && <LoadingBlock />}
            {error && <ErrorState error={error} onRetry={reload} />}
            {!loading && !error && threads.length === 0 && (
              <EmptyState icon="📨" title="No threads" description="Nothing returned for this business." />
            )}
            {!loading && !error && threads.length > 0 && (
              <ul className="sec-editor__items">
                {threads.map((thread, index) => (
                  <li className="sec-editor__item" key={thread.id || index}>
                    <div className="sec-editor__itembody">
                      <div className="sec-editor__itemname">
                        {thread.customer_name || thread.phone || `Thread ${index + 1}`}
                      </div>
                      <div className="sec-editor__itemdesc">
                        {thread.last_message || thread.body}
                      </div>
                    </div>
                    <div className="faint mono">{formatDateTime(thread.updated_at || thread.created_at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  );
}
