/**
 * Sponsored placements in the swipe deck.
 *
 * GET/POST /api/admin/tripswipe/sponsored
 * PUT/DELETE /api/admin/tripswipe/sponsored/:id
 */

import { Notice } from '../../ui/primitives.jsx';
import { CrudSection } from '../../ui/CrudSection.jsx';
import { sponsoredResource } from '../../api/resources.js';
import { columns, fields } from '../../lib/fields.jsx';

// `tripswipe_sponsored` on the live database: entity_slug, entity_name, label,
// image_url, priority, active. PUT writes the body as-is, so the form uses
// exactly those columns. POST is not offered: the API's create handler inserts
// business_name / images / description / cta_* / dates, none of which are
// columns, so every create fails until routes/admin.js is fixed.
const schema = [
  fields.text('entity_name', 'Business name', { required: true }),
  fields.text('entity_slug', 'Entity slug', { help: 'Links the placement to a GCR listing.' }),
  fields.text('label', 'Label', { placeholder: 'Sponsored', span: 2 }),
  fields.image('image_url', 'Image URL'),
  fields.number('priority', 'Priority', { step: 1, help: 'Higher shows first.' }),
  fields.bool('active', 'Active', { defaultValue: true }),
];

export default function Sponsored() {
  return (
    <CrudSection
      title="Sponsored placements"
      description="Paid cards injected into the Trip Swipe deck."
      resource={sponsoredResource}
      labelFor={(row) => row.entity_name || row.entity_slug}
      canCreate={false}
      emptyTitle="No sponsored placements"
      searchPlaceholder="Search placements…"
      columns={[
        columns.thumb('image_url'),
        columns.primary('entity_name', 'Business', 'entity_slug'),
        columns.text('label', 'Label'),
        columns.number('priority', 'Priority'),
        columns.bool('active', 'Active'),
      ]}
      formSchema={schema}
      initialSort={{ key: 'priority', direction: 'desc' }}
    >
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Notice tone="warning" title="New placements cannot be created yet">
          The API's create handler writes fields the sponsored table does not have, so it fails.
          Existing placements can be edited and removed here.
        </Notice>
      </div>
    </CrudSection>
  );
}
