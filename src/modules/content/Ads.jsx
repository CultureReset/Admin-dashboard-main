/**
 * Ad network.
 *
 * GET/POST /api/admin/gcr/ads, PUT/DELETE /api/admin/gcr/ads/:id
 */

import { CrudSection } from '../../ui/CrudSection.jsx';
import { adsResource } from '../../api/resources.js';
import { columns, fields } from '../../lib/fields.jsx';

const adSchema = {
  groups: [
    {
      title: 'Advertiser',
      fields: [
        fields.text('advertiser_name', 'Advertiser', { required: true, span: 2 }),
        fields.text('tagline', 'Tagline', { span: 2 }),
        fields.text('badge_text', 'Badge text', { placeholder: 'Sponsored' }),
      ],
    },
    {
      title: 'Creative',
      fields: [
        fields.image('image_url', 'Image URL'),
        fields.image('logo_url', 'Logo URL'),
      ],
    },
    {
      title: 'Call to action',
      fields: [
        fields.text('cta_text', 'Button text', { placeholder: 'Learn more' }),
        fields.url('cta_url', 'Button URL'),
      ],
    },
    {
      title: 'Delivery',
      fields: [
        fields.number('weight', 'Weight', {
          min: 0,
          step: 1,
          help: 'Relative share of impressions against other active ads.',
        }),
        fields.bool('is_active', 'Active', { defaultValue: true }),
      ],
    },
  ],
};

export default function Ads() {
  return (
    <CrudSection
      title="Ad network"
      description="Sponsored slots served across the public GCR site."
      resource={adsResource}
      labelFor={(row) => row.advertiser_name}
      createLabel="Add ad"
      modalSize="lg"
      emptyTitle="No ads"
      emptyDescription="Nothing is being served right now."
      searchPlaceholder="Search advertisers…"
      columns={[
        columns.thumb('image_url'),
        columns.primary('advertiser_name', 'Advertiser', 'tagline'),
        columns.text('badge_text', 'Badge'),
        columns.link('cta_url', 'Link', { label: (row) => row.cta_text || 'Open' }),
        columns.number('weight', 'Weight'),
        columns.bool('is_active', 'Active', { trueLabel: 'Serving', falseLabel: 'Paused' }),
      ]}
      formSchema={adSchema}
    />
  );
}
