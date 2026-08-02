/**
 * Song requests and tips for a chosen artist.
 *
 * GET   /api/artists                    roster
 * GET   /api/artists/:slug/queue        live request queue
 * PATCH /api/artists/:slug/queue/:id    change a request's status
 */

import { useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Stat } from '../../ui/primitives.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { formatDateTime, formatMoney } from '../../lib/fields.jsx';

const QUEUE_STATUSES = [
  { value: 'pending', label: 'Pending', tone: 'warning' },
  { value: 'accepted', label: 'Accepted', tone: 'info' },
  { value: 'played', label: 'Played', tone: 'success' },
  { value: 'declined', label: 'Declined', tone: 'danger' },
];

export default function ArtistProfiles() {
  const toast = useToast();
  const [slug, setSlug] = useState('');

  const artistsQuery = useAsync(
    async () => unwrapList(await api.get(endpoints.artists.publicList(), { auth: false }), ['artists']),
    [],
    { initialData: [] },
  );

  const queueQuery = useAsync(
    async () => {
      if (!slug) return [];
      return unwrapList(await api.get(endpoints.artists.queue(slug), { auth: false }), [
        'queue',
        'requests',
      ]);
    },
    [slug],
    { initialData: [] },
  );

  const artists = artistsQuery.data || [];
  const queue = queueQuery.data || [];
  const artist = artists.find((a) => a.slug === slug);

  const totalTips = queue.reduce((sum, row) => sum + Number(row.tip_amount || 0), 0);
  const pending = queue.filter((row) => (row.status || 'pending') === 'pending').length;

  const setStatus = async (row, status) => {
    try {
      await api.patch(endpoints.artists.queueItem(slug, row.id), { status });
      toast.success(`Marked ${status}.`);
      await queueQuery.reload();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <>
      <PageHeader
        title="Song requests & tips"
        description="The live request queue for a performer, and what listeners tipped."
        actions={
          <Button onClick={queueQuery.reload} disabled={!slug || queueQuery.loading}>
            Refresh queue
          </Button>
        }
      />

      <Card title="Artist" subtitle="Pick a performer to see their queue.">
        {artistsQuery.error && <ErrorState error={artistsQuery.error} onRetry={artistsQuery.reload} />}
        {artistsQuery.loading && <LoadingBlock />}
        {!artistsQuery.loading && !artistsQuery.error && (
          <select
            className="ui-input ui-input--select"
            style={{ maxWidth: 360 }}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          >
            <option value="">— choose an artist —</option>
            {artists.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
                {item.genre ? ` · ${item.genre}` : ''}
              </option>
            ))}
          </select>
        )}
      </Card>

      {slug && (
        <>
          <div className="grid-auto" style={{ margin: 'var(--space-5) 0' }}>
            <Stat label="Requests" value={queue.length} />
            <Stat label="Pending" value={pending} tone={pending ? 'warning' : 'neutral'} />
            <Stat label="Tips" value={formatMoney(totalTips) || '$0.00'} tone="success" />
          </div>

          <Card title={artist ? `${artist.name} — queue` : 'Queue'}>
            {queueQuery.error && <ErrorState error={queueQuery.error} onRetry={queueQuery.reload} />}
            {queueQuery.loading && <LoadingBlock />}
            {!queueQuery.loading && !queueQuery.error && queue.length === 0 && (
              <EmptyState icon="🎤" title="Nothing in the queue" description="No requests have come in." />
            )}
            {!queueQuery.loading && !queueQuery.error && queue.length > 0 && (
              <ul className="sec-editor__items">
                {queue.map((row) => {
                  const status = row.status || 'pending';
                  const tone = QUEUE_STATUSES.find((s) => s.value === status)?.tone || 'neutral';
                  return (
                    <li className="sec-editor__item" key={row.id}>
                      <div className="sec-editor__itembody">
                        <div className="sec-editor__itemname">
                          {row.song_title || row.song || 'Request'}
                          <Badge tone={tone}>{status}</Badge>
                          {row.tip_amount > 0 && (
                            <Badge tone="success">{formatMoney(row.tip_amount)}</Badge>
                          )}
                        </div>
                        <div className="sec-editor__itemdesc">
                          {[row.requester_name, row.message, formatDateTime(row.created_at)]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        {QUEUE_STATUSES.filter((s) => s.value !== status).map((option) => (
                          <Button key={option.value} size="sm" onClick={() => setStatus(row, option.value)}>
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  );
}
