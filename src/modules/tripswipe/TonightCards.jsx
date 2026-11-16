/**
 * Tonight cards — date-scoped promo cards in the Trip Swipe deck.
 *
 * GET/POST /api/admin/tripswipe/promo-cards
 * PUT/DELETE /api/admin/tripswipe/promo-cards/:id
 */

import { Notice } from '../../ui/primitives.jsx';
import { CrudSection } from '../../ui/CrudSection.jsx';
import { promoCardsResource } from '../../api/resources.js';
import { columns, fields } from '../../lib/fields.jsx';

// `tripswipe_promo_cards` on the live database: title, subtitle, image_url,
// cta_text, cta_url, active, priority — there is no date or description
// column. PUT writes the body as-is, so the form uses exactly those. POST is
// not offered: the API's create handler always inserts is_active (and
// description / show_date when given), which are not columns, so it fails
// until routes/admin.js is fixed.
const schema = [
  fields.text('title', 'Title', { required: true, span: 2 }),
  fields.text('subtitle', 'Subtitle', { span: 2 }),
  fields.image('image_url', 'Image URL'),
  fields.text('cta_text', 'Button text', { placeholder: 'See more' }),
  fields.url('cta_url', 'Button URL'),
  fields.number('priority', 'Priority', { step: 1, help: 'Higher shows first.' }),
  fields.bool('active', 'Active', { defaultValue: true }),
];

export default function TonightCards() {
  return (
    <CrudSection
      title="Tonight cards"
      description="Promo cards that appear in the Trip Swipe deck."
      resource={promoCardsResource}
      labelFor={(row) => row.title}
      canCreate={false}
      modalSize="lg"
      emptyTitle="No tonight cards"
      searchPlaceholder="Search cards…"
      columns={[
        columns.thumb('image_url'),
        columns.primary('title', 'Card', 'subtitle'),
        columns.text('cta_text', 'Button'),
        columns.number('priority', 'Priority'),
        columns.bool('active', 'Active'),
      ]}
      formSchema={schema}
      initialSort={{ key: 'priority', direction: 'desc' }}
    >
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Notice tone="warning" title="New cards cannot be created yet">
          The API's create handler writes fields the promo-cards table does not have, so it fails.
          Existing cards can be edited and removed here.
        </Notice>
      </div>
    </CrudSection>
  );
}
