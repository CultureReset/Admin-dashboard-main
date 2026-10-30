/**
 * SMS / messaging threads per business.
 *
 * Live API (gcr-api-clean routes/messaging.js, authRequired):
 *   GET  /api/messaging/conversations/:entity_slug  → thread[]
 *   GET  /api/messaging/conversations/:id/messages  → message[]
 *   POST /api/messaging/messages                    → send
 *
 * Thread rows include live columns plus legacy aliases
 * (business_id, participant_phone, conversation_id).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader, Badge } from '../../ui/primitives.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { formatDateTime } from '../../lib/fields.jsx';

/** Normalize one API thread into the fields this screen renders. */
function mapThread(row) {
  if (!row || typeof row !== 'object') return null;
  const id = row.id || row.conversation_id || row.thread_id;
  const phone = row.participant_phone || row.customer_address || row.phone || null;
  return {
    id,
    phone,
    customer_name: row.customer_name || row.customer_label || null,
    channel: row.channel || 'sms',
    mode: row.mode || null,
    last_message: row.last_message || row.subject || null,
    last_message_at: row.last_message_at || row.updated_at || row.created_at || null,
    is_active: row.is_active !== false,
    raw: row,
  };
}

export default function Messaging() {
  const [slug, setSlug] = useState(null);

  const { data, loading, error, reload } = useAsync(
    async () => {
      if (!slug) return [];
      const payload = await api.get(endpoints.messaging.conversations(slug));
      const rows = unwrapList(payload, ['conversations', 'threads', 'messages']);
      return rows.map(mapThread).filter(Boolean);
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

      <Notice tone="info" title="Live messaging API">
        <p>
          Threads load from <code className="mono">GET /api/messaging/conversations/:entity_slug</code>
          {' '}on gcr-api-clean (auth required). Outbound SMS blasts still live under{' '}
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
          <Card title="Threads" subtitle={`${threads.length} conversation${threads.length === 1 ? '' : 's'}`}>
            {loading && <LoadingBlock label="Loading threads…" />}
            {error && <ErrorState error={error} onRetry={reload} context="messaging" />}
            {!loading && !error && threads.length === 0 && (
              <EmptyState
                icon="📨"
                title="No threads"
                description="No message_threads rows for this business yet."
              />
            )}
            {!loading && !error && threads.length > 0 && (
              <ul className="sec-editor__items">
                {threads.map((thread, index) => (
                  <li className="sec-editor__item" key={thread.id || index}>
                    <div className="sec-editor__itembody">
                      <div className="sec-editor__itemname">
                        {thread.customer_name || thread.phone || `Thread ${index + 1}`}
                        {thread.channel && <Badge tone="neutral">{thread.channel}</Badge>}
                        {!thread.is_active && <Badge tone="warning">Inactive</Badge>}
                      </div>
                      <div className="sec-editor__itemdesc">
                        {thread.last_message || (thread.phone ? `SMS · ${thread.phone}` : 'No preview')}
                      </div>
                    </div>
                    <div className="faint mono">{formatDateTime(thread.last_message_at)}</div>
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
