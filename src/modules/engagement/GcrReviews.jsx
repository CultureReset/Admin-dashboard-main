/**
 * Reviews attached to GCR entities.
 *
 * Reviews are per-entity in the API:
 *   GET/POST /api/admin/gcr/entities/:slug/reviews
 *   PUT/DELETE /api/admin/gcr/reviews/:id
 *
 * There is no directory-wide review list route, so this screen scopes to one
 * business at a time rather than pretending to show everything.
 */

import { useState } from 'react';
import { PageHeader, Notice } from '../../ui/primitives.jsx';
import { CrudSection } from '../../ui/CrudSection.jsx';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { entityReviewsResource } from '../../api/resources.js';
import { columns, fields } from '../../lib/fields.jsx';
import { usePersistentState } from '../../hooks/useAsync.js';

const reviewSchema = [
  fields.text('author_name', 'Author', { required: true, span: 2 }),
  fields.number('rating', 'Rating', { min: 0, max: 5, step: 0.5 }),
  fields.text('source', 'Source', { placeholder: 'Google, Yelp, direct…' }),
  fields.textarea('review_text', 'Review', { rows: 5 }),
  fields.date('review_date', 'Date'),
];

export default function GcrReviews() {
  const [slug, setSlug] = usePersistentState('cc_admin_entity', null);
  const [touched, setTouched] = useState(false);

  return (
    <>
      <PageHeader
        title="Reviews"
        description="Reviews stored against a GCR listing."
      />

      <div style={{ marginBottom: 'var(--space-5)', maxWidth: 460 }}>
        <EntityPicker
          value={slug}
          onChange={(next) => {
            setSlug(next);
            setTouched(true);
          }}
          label="Business"
        />
      </div>

      {!slug ? (
        <Notice tone="info" title="Pick a business">
          The API stores reviews per entity and has no directory-wide list route, so choose a
          listing above to see its reviews.
        </Notice>
      ) : (
        <CrudSection
          key={slug}
          title={touched ? 'Reviews' : 'Reviews'}
          description="Attached to the selected business."
          resource={entityReviewsResource}
          params={{ slug }}
          labelFor={(row) => row.author_name || 'Review'}
          createLabel="Add review"
          modalSize="lg"
          emptyTitle="No reviews"
          searchPlaceholder="Search reviews…"
          columns={[
            columns.primary('author_name', 'Author', 'source'),
            {
              key: 'rating',
              header: 'Rating',
              align: 'right',
              render: (row) =>
                row.rating != null ? `${Number(row.rating).toFixed(1)} ★` : <span className="faint">—</span>,
            },
            columns.text('review_text', 'Review'),
            columns.date('review_date', 'Date'),
          ]}
          formSchema={reviewSchema}
          initialSort={{ key: 'review_date', direction: 'desc' }}
        />
      )}
    </>
  );
}
