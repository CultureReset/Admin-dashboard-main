/**
 * Sponsored placements in the swipe deck.
 *
 * GET/POST /api/admin/tripswipe/sponsored
 * PUT/DELETE /api/admin/tripswipe/sponsored/:id
 */

import { CrudSection } from '../../ui/CrudSection.jsx';
import { sponsoredResource } from '../../api/resources.js';
import { columns, fields } from '../../lib/fields.jsx';

const schema = {
  groups: [
    {
      title: 'Business',
      fields: [
        fields.text('business_name', 'Business name', { required: true, span: 2 }),
        fields.text('entity_slug', 'Entity slug', {
          help: 'Links the placement to a GCR listing.',
        }),
        fields.textarea('description', 'Description', { rows: 3 }),
      ],
    },
    {
      title: 'Creative',
      fields: [
        fields.tags('images', 'Image URLs', {
          span: 'full',
          help: 'Comma-separated. Shown as a card carousel.',
        }),
        fields.text('cta_text', 'Button text', { placeholder: 'Book now' }),
        fields.url('cta_url', 'Button URL'),
      ],
    },
    {
      title: 'Flight dates',
      fields: [
        fields.date('start_date', 'Starts'),
        fields.date('end_date', 'Ends'),
      ],
    },
  ],
};

export default function Sponsored() {
  return (
    <CrudSection
      title="Sponsored placements"
      description="Paid cards injected into the Trip Swipe deck."
      resource={sponsoredResource}
      labelFor={(row) => row.business_name}
      createLabel="Add placement"
      modalSize="lg"
      emptyTitle="No sponsored placements"
      searchPlaceholder="Search placements…"
      columns={[
        {
          key: 'images',
          header: '',
          width: '56px',
          sortable: false,
          searchable: false,
          render: (row) => {
            const first = Array.isArray(row.images) ? row.images[0] : row.images;
            return first ? (
              <img className="ui-cell-thumb" src={first} alt="" loading="lazy" />
            ) : (
              <div className="ui-cell-thumb" />
            );
          },
        },
        columns.primary('business_name', 'Business', 'entity_slug'),
        columns.text('cta_text', 'CTA'),
        columns.date('start_date', 'Starts'),
        columns.date('end_date', 'Ends'),
      ]}
      formSchema={schema}
      initialSort={{ key: 'start_date', direction: 'desc' }}
    />
  );
}
