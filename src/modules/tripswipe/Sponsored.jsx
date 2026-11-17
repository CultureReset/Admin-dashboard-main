/**
 * Sponsored placements in the swipe deck.
 *
 * GET/POST /api/admin/tripswipe/sponsored
 * PUT/DELETE /api/admin/tripswipe/sponsored/:id
 */

import { CrudSection } from '../../ui/CrudSection.jsx';
import { sponsoredResource } from '../../api/resources.js';
import { blankToNull, columns, fields } from '../../lib/fields.jsx';

// `tripswipe_sponsored` on the live database: entity_slug, entity_name,
// image_url, label, active, priority. The API writes only those columns and
// rejects a create that names neither entity_slug nor entity_name, so the form
// asks for at least one of the two.
const needBusiness = (value, values) =>
  !String(values.entity_name ?? '').trim() && !String(values.entity_slug ?? '').trim()
    ? 'Enter a business name or a slug.'
    : null;

const schema = [
  fields.text('entity_name', 'Business name', { validate: needBusiness }),
  fields.text('entity_slug', 'Entity slug', {
    help: 'Links the placement to a GCR listing. A name or a slug is required.',
    validate: needBusiness,
  }),
  fields.text('label', 'Label', { placeholder: 'Sponsored', span: 2 }),
  fields.image('image_url', 'Image URL'),
  fields.number('priority', 'Priority', { step: 1, defaultValue: 0, help: 'Higher shows first.' }),
  fields.bool('active', 'Active', { defaultValue: true }),
];

export default function Sponsored() {
  return (
    <CrudSection
      title="Sponsored placements"
      description="Paid cards injected into the Trip Swipe deck."
      resource={sponsoredResource}
      labelFor={(row) => row.entity_name || row.entity_slug}
      createLabel="Add placement"
      emptyTitle="No sponsored placements"
      emptyDescription="Add a placement to inject a sponsored card into the deck."
      searchPlaceholder="Search placements…"
      columns={[
        columns.thumb('image_url'),
        columns.primary('entity_name', 'Business', 'entity_slug'),
        columns.text('label', 'Label'),
        columns.number('priority', 'Priority'),
        columns.bool('active', 'Active'),
      ]}
      formSchema={schema}
      fromFormValues={blankToNull}
      initialSort={{ key: 'priority', direction: 'desc' }}
    />
  );
}
