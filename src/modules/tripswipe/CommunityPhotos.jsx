/**
 * Guest photo moderation.
 *
 * /api/admin/community-photos is called by the legacy dashboard but is absent
 * from gcr-api-clean, so this reports the gap rather than showing an empty
 * queue that looks like "nothing to moderate".
 */

import { useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader } from '../../ui/primitives.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useConfirm } from '../../ui/Modal.jsx';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { formatDateTime } from '../../lib/fields.jsx';
import '../directory/tabs/PhotosTab.css';

const STATUSES = [
  { value: 'pending', label: 'Pending', tone: 'warning' },
  { value: 'approved', label: 'Approved', tone: 'success' },
  { value: 'rejected', label: 'Rejected', tone: 'danger' },
];

export default function CommunityPhotos() {
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const [confirm, confirmElement] = useConfirm();

  const { data, loading, error, reload } = useAsync(
    async () =>
      unwrapList(await api.get(endpoints.photos.community(), { query: { status } }), ['photos']),
    [status],
    { initialData: [] },
  );

  const photos = data || [];

  const setPhotoStatus = async (photo, nextStatus) => {
    if (nextStatus === 'rejected') {
      const ok = await confirm({
        title: 'Reject photo',
        message: 'Reject this guest photo? It will not appear on the public site.',
        confirmLabel: 'Reject',
      });
      if (!ok) return;
    }
    try {
      await api.patch(endpoints.photos.communityItem(photo.id), { status: nextStatus });
      toast.success(`Photo ${nextStatus}.`);
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <>
      <PageHeader
        title="Guest photos"
        description="Photos submitted by visitors, awaiting review before they go live."
        actions={
          <>
            <select
              className="ui-input ui-input--select"
              style={{ width: 'auto' }}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUSES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <Button onClick={reload} disabled={loading}>Refresh</Button>
          </>
        }
      />

      {error?.isMissingEndpoint && (
        <>
          <Notice tone="warning" title="This screen's API route is not deployed">
            <code className="mono">{error.path}</code> is called by the previous dashboard but does
            not exist in <code>gcr-api-clean</code>. Approving or rejecting will fail until it does.
          </Notice>
          <div style={{ height: 'var(--space-4)' }} />
        </>
      )}

      <Card title={`${STATUSES.find((s) => s.value === status)?.label} photos`}>
        {loading && <LoadingBlock />}
        {error && !error.isMissingEndpoint && <ErrorState error={error} onRetry={reload} />}

        {!loading && !error && photos.length === 0 && (
          <EmptyState
            icon="📸"
            title={`No ${status} photos`}
            description="Nothing in this queue."
          />
        )}

        {!loading && photos.length > 0 && (
          <div className="photos-grid">
            {photos.map((photo) => (
              <figure className="photo-card" key={photo.id}>
                <img src={photo.url || photo.image_url} alt={photo.caption || ''} loading="lazy" />
                <figcaption>
                  <span className="photo-card__caption truncate">
                    {photo.caption || photo.entity_slug || 'Guest photo'}
                  </span>
                  <Badge tone={STATUSES.find((s) => s.value === (photo.status || status))?.tone}>
                    {photo.status || status}
                  </Badge>
                </figcaption>
                <p className="faint mono" style={{ padding: '0 var(--space-3)', fontSize: 11 }}>
                  {[photo.submitted_by, formatDateTime(photo.created_at)].filter(Boolean).join(' · ')}
                </p>
                <div className="photo-card__actions">
                  {(photo.status || status) !== 'approved' && (
                    <Button size="sm" variant="success" onClick={() => setPhotoStatus(photo, 'approved')}>
                      Approve
                    </Button>
                  )}
                  {(photo.status || status) !== 'rejected' && (
                    <Button size="sm" variant="danger" onClick={() => setPhotoStatus(photo, 'rejected')}>
                      Reject
                    </Button>
                  )}
                </div>
              </figure>
            ))}
          </div>
        )}
      </Card>

      {confirmElement}
    </>
  );
}
