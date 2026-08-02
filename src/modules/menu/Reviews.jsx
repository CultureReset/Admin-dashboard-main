/**
 * Reviews for one business — the public read model.
 *
 * GET /api/reviews/:slug         approved reviews, paginated
 * GET /api/reviews/:slug/stats   rating breakdown
 *
 * Both routes are slug-scoped. `routes/reviews.js` has no collection route,
 * so there is no "all reviews across the platform" view to build here.
 *
 * The legacy dashboard also drove an SMS review-request flow against
 * /api/reviews/request, /api/reviews/requests and /api/reviews/webhook/pos.
 * None of those exist. Worse, they do not 404 — they match the slug routes, so
 * `POST /api/reviews/request` would have created a review against a business
 * named "request". That flow is not reproduced here; the notice below says so
 * rather than offering a button that corrupts data.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useAsync, usePersistentState } from '../../hooks/useAsync.js';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, formatNumber } from '../../lib/fields.jsx';

export default function Reviews() {
  const [slug, setSlug] = usePersistentState('cc_admin_entity', null);

  const reviewsQuery = useAsync(
    async () => {
      if (!slug) return [];
      const payload = await api.get(endpoints.reviews.bySlug(slug), {
        auth: false,
        query: { limit: 200 },
      });
      return unwrapList(payload, ['reviews']);
    },
    [slug],
    { initialData: [] },
  );

  const statsQuery = useAsync(
    async () => {
      if (!slug) return null;
      return api.get(endpoints.reviews.statsBySlug(slug), { auth: false });
    },
    [slug],
    { initialData: null },
  );

  const reviews = reviewsQuery.data || [];
  const stats = statsQuery.data || {};

  const average = useMemo(() => {
    if (typeof stats.average === 'number') return stats.average;
    if (reviews.length === 0) return null;
    const total = reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0);
    return total / reviews.length;
  }, [stats, reviews]);

  const breakdown = useMemo(() => {
    // Prefer the API's own breakdown; fall back to counting what we loaded.
    if (stats.breakdown && typeof stats.breakdown === 'object') return stats.breakdown;
    const out = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const review of reviews) {
      const bucket = Math.round(Number(review.rating) || 0);
      if (out[bucket] !== undefined) out[bucket] += 1;
    }
    return out;
  }, [stats, reviews]);

  const refresh = () => {
    reviewsQuery.reload();
    statsQuery.reload();
  };

  return (
    <>
      <PageHeader
        title="Reviews"
        description="Approved public reviews for one business, as visitors see them."
        actions={slug && <Button onClick={refresh} disabled={reviewsQuery.loading}>Refresh</Button>}
      />

      <Notice tone="info" title="What this screen is, and is not">
        <p>
          This is the <strong>public</strong> read model — approved reviews only, for one business.
          To add, edit, unapprove, or delete reviews, use{' '}
          <Link to="/engagement/reviews">Engagement → Reviews</Link>, which is backed by the admin
          router and shows unapproved rows too.
        </p>
        <p style={{ marginTop: 8 }}>
          The SMS review-request flow the previous dashboard offered has no API behind it —{' '}
          <code className="mono">/api/reviews/request</code> and{' '}
          <code className="mono">/api/reviews/requests</code> do not exist. It is not reproduced
          here.
        </p>
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <Card title="Business">
        <EntityPicker value={slug} onChange={setSlug} label="Show reviews for" />
      </Card>

      {slug && (
        <>
          <div className="grid-auto" style={{ margin: 'var(--space-5) 0' }}>
            <Stat
              label="Approved reviews"
              value={reviewsQuery.loading ? '…' : formatNumber(stats.total ?? reviews.length)}
              tone="primary"
            />
            <Stat
              label="Average rating"
              value={average != null ? `${average.toFixed(2)} ★` : '—'}
              tone={average >= 4 ? 'success' : average >= 3 ? 'warning' : average != null ? 'danger' : 'neutral'}
            />
            {[5, 4, 3, 2, 1].map((score) => (
              <Stat key={score} label={`${score} star`} value={breakdown[score] ?? 0} />
            ))}
          </div>

          <Card padded={false} title="Approved reviews">
            <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
              {statsQuery.error && !statsQuery.error.isMissingEndpoint && (
                <>
                  <ErrorState error={statsQuery.error} onRetry={statsQuery.reload} />
                  <div style={{ height: 'var(--space-3)' }} />
                </>
              )}
              {reviewsQuery.loading && <LoadingBlock />}
              {reviewsQuery.error && (
                <ErrorState error={reviewsQuery.error} onRetry={reviewsQuery.reload} />
              )}
              {!reviewsQuery.loading && !reviewsQuery.error && reviews.length === 0 && (
                <EmptyState
                  icon="⭐"
                  title="No approved reviews"
                  description="This business has no reviews that have been approved for public display."
                />
              )}
              {!reviewsQuery.loading && !reviewsQuery.error && reviews.length > 0 && (
                <DataTable
                  columns={[
                    columns.primary('author_name', 'Author', 'source'),
                    {
                      key: 'rating',
                      header: 'Rating',
                      align: 'right',
                      render: (row) =>
                        row.rating != null ? (
                          <Badge
                            tone={
                              Number(row.rating) >= 4
                                ? 'success'
                                : Number(row.rating) >= 3
                                  ? 'warning'
                                  : 'danger'
                            }
                          >
                            {Number(row.rating).toFixed(1)} ★
                          </Badge>
                        ) : (
                          <span className="faint">—</span>
                        ),
                    },
                    columns.text('review_text', 'Review'),
                    columns.dateTime('created_at', 'Received'),
                  ]}
                  rows={reviews}
                  rowKey={(row, index) => row.id ?? index}
                  searchPlaceholder="Search reviews…"
                  initialSort={{ key: 'created_at', direction: 'desc' }}
                />
              )}
            </div>
          </Card>
        </>
      )}

      {!slug && (
        <>
          <div style={{ height: 'var(--space-4)' }} />
          <div className="entity-picker__prompt">Pick a business to see its public reviews.</div>
        </>
      )}
    </>
  );
}
