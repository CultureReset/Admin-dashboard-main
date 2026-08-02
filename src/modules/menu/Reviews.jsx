/**
 * Review requests and responses.
 *
 * GET  /api/reviews          reviews collected
 * GET  /api/reviews/stats    summary counters
 * GET  /api/reviews/requests requests sent
 * POST /api/reviews/request  send a new request
 */

import { useState } from 'react';
import { Badge, Button, Card, ErrorState, LoadingBlock, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, fields, formatNumber } from '../../lib/fields.jsx';

const requestSchema = [
  fields.text('customer_name', 'Customer name', { span: 2 }),
  fields.tel('phone', 'Phone', { help: 'Where the request is texted.' }),
  fields.email('email', 'Email'),
  fields.textarea('message', 'Custom message', { rows: 3 }),
];

const TABS = [
  { id: 'reviews', label: 'Reviews' },
  { id: 'requests', label: 'Requests sent' },
];

export default function Reviews() {
  const toast = useToast();
  const [tab, setTab] = useState('reviews');
  const [requesting, setRequesting] = useState(false);
  const [slug, setSlug] = useState(null);

  const statsQuery = useAsync(async () => api.get(endpoints.reviews.stats()), [], {
    initialData: null,
  });

  const reviewsQuery = useAsync(
    async () => unwrapList(await api.get(endpoints.reviews.list()), ['reviews']),
    [],
    { initialData: [] },
  );

  const requestsQuery = useAsync(
    async () => unwrapList(await api.get(endpoints.reviews.requests()), ['requests']),
    [],
    { initialData: [] },
  );

  const sendRequest = async (values) => {
    await api.post(endpoints.reviews.request(), { ...values, entity_slug: slug || undefined });
    toast.success('Review request sent.');
    setRequesting(false);
    await requestsQuery.reload();
  };

  const stats = statsQuery.data || {};

  return (
    <>
      <PageHeader
        title="Reviews"
        description="Review requests sent to customers, and the reviews that came back."
        actions={
          <>
            <Button
              onClick={() => {
                statsQuery.reload();
                reviewsQuery.reload();
                requestsQuery.reload();
              }}
            >
              Refresh
            </Button>
            <Button variant="primary" onClick={() => setRequesting(true)}>
              Request a review
            </Button>
          </>
        }
      />

      {statsQuery.loading && <LoadingBlock />}
      {statsQuery.error && !statsQuery.error.isMissingEndpoint && (
        <ErrorState error={statsQuery.error} onRetry={statsQuery.reload} />
      )}
      {!statsQuery.loading && !statsQuery.error && (
        <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
          {Object.entries(stats)
            .filter(([, value]) => typeof value !== 'object')
            .map(([key, value]) => (
              <Stat
                key={key}
                label={key.replace(/_/g, ' ')}
                value={typeof value === 'number' ? formatNumber(value) : String(value)}
              />
            ))}
        </div>
      )}

      <div className="ui-tabs__bar" role="tablist" style={{ marginBottom: 'var(--space-4)' }}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`ui-tabs__tab ${tab === item.id ? 'is-active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            <span className="ui-tabs__badge">
              {item.id === 'reviews'
                ? (reviewsQuery.data || []).length
                : (requestsQuery.data || []).length}
            </span>
          </button>
        ))}
      </div>

      <Card padded={false}>
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          {tab === 'reviews' ? (
            <DataTable
              columns={[
                columns.primary('author_name', 'Author', 'source'),
                {
                  key: 'rating',
                  header: 'Rating',
                  align: 'right',
                  render: (row) =>
                    row.rating != null ? (
                      <Badge tone={Number(row.rating) >= 4 ? 'success' : Number(row.rating) >= 3 ? 'warning' : 'danger'}>
                        {Number(row.rating).toFixed(1)} ★
                      </Badge>
                    ) : (
                      <span className="faint">—</span>
                    ),
                },
                columns.text('review_text', 'Review'),
                columns.text('entity_slug', 'Business'),
                columns.dateTime('created_at', 'Received'),
              ]}
              rows={reviewsQuery.data || []}
              loading={reviewsQuery.loading}
              error={reviewsQuery.error}
              onRetry={reviewsQuery.reload}
              rowKey={(row, index) => row.id ?? index}
              searchPlaceholder="Search reviews…"
              emptyTitle="No reviews"
              initialSort={{ key: 'created_at', direction: 'desc' }}
            />
          ) : (
            <DataTable
              columns={[
                columns.primary('customer_name', 'Customer', 'phone'),
                columns.text('entity_slug', 'Business'),
                columns.status('status', 'Status', {
                  sent: 'info',
                  delivered: 'success',
                  failed: 'danger',
                  clicked: 'primary',
                }),
                columns.dateTime('created_at', 'Sent'),
              ]}
              rows={requestsQuery.data || []}
              loading={requestsQuery.loading}
              error={requestsQuery.error}
              onRetry={requestsQuery.reload}
              rowKey={(row, index) => row.id ?? index}
              searchPlaceholder="Search requests…"
              emptyTitle="No requests sent"
              initialSort={{ key: 'created_at', direction: 'desc' }}
            />
          )}
        </div>
      </Card>

      <Modal
        open={requesting}
        onClose={() => setRequesting(false)}
        title="Request a review"
        description="Sends the customer a link asking them to leave a review."
      >
        <div className="stack">
          <EntityPicker value={slug} onChange={setSlug} label="Business (optional)" />
          <SchemaForm
            schema={requestSchema}
            onSubmit={sendRequest}
            onCancel={() => setRequesting(false)}
            submitLabel="Send request"
          />
        </div>
      </Modal>
    </>
  );
}
