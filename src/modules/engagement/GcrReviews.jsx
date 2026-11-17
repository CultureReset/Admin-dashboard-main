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

import { PageHeader, Notice } from '../../ui/primitives.jsx';
import { CrudSection } from '../../ui/CrudSection.jsx';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { entityReviewsResource } from '../../api/resources.js';
import { columns, fields } from '../../lib/fields.jsx';
import { usePersistentState } from '../../hooks/useAsync.js';

// Columns of `entity_reviews` on the live database. The admin routes pass the
// body straight to insert/update, so a field name that is not a column fails
// the whole save. `rating` is an integer constrained to 1–5.
const reviewSchema = [
  fields.text('reviewer_name', 'Reviewer', { required: true }),
  fields.email('reviewer_email', 'Reviewer email', { omitWhenEmpty: true }),
  fields.number('rating', 'Rating (1–5)', { required: true, min: 1, max: 5, step: 1 }),
  fields.text('source_system', 'Source', { placeholder: 'Google, Yelp, direct…', omitWhenEmpty: true }),
  fields.text('title', 'Title', { span: 'full' }),
  fields.textarea('body', 'Review', { rows: 5 }),
  fields.bool('approved', 'Approved for public display', { defaultValue: true }),
];

export default function GcrReviews() {
  const [slug, setSlug] = usePersistentState('cc_admin_entity', null);

  return (
    <>
      <PageHeader
        title="Reviews"
        description="Reviews stored against a GCR listing."
      />

      <div style={{ marginBottom: 'var(--space-5)', maxWidth: 460 }}>
        <EntityPicker
          value={slug}
          onChange={setSlug}
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
          title="Reviews"
          description="Attached to the selected business."
          resource={entityReviewsResource}
          params={{ slug }}
          labelFor={(row) => row.reviewer_name || 'Review'}
          createLabel="Add review"
          modalSize="lg"
          emptyTitle="No reviews"
          searchPlaceholder="Search reviews…"
          columns={[
            columns.primary('reviewer_name', 'Reviewer', 'source_system'),
            {
              key: 'rating',
              header: 'Rating',
              align: 'right',
              render: (row) =>
                row.rating != null ? `${Number(row.rating).toFixed(1)} ★` : <span className="faint">—</span>,
            },
            columns.text('body', 'Review'),
            columns.bool('approved', 'Public'),
            columns.date('created_at', 'Date'),
          ]}
          formSchema={reviewSchema}
          initialSort={{ key: 'created_at', direction: 'desc' }}
        />
      )}
    </>
  );
}
