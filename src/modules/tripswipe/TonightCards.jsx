/**
 * Tonight cards — promo cards in the Trip Swipe deck.
 *
 * GET/POST /api/admin/tripswipe/promo-cards
 * PUT/DELETE /api/admin/tripswipe/promo-cards/:id
 */

import { CrudSection } from '../../ui/CrudSection.jsx';
import { promoCardsResource } from '../../api/resources.js';
import { blankToNull, columns, fields, notBlank } from '../../lib/fields.jsx';

// `tripswipe_promo_cards` on the live database: title, subtitle, image_url,
// cta_text, cta_url, active, priority — there is no date or description
// column. The API writes only those columns and requires a title.
const schema = [
  fields.text('title', 'Title', { required: true, span: 2, validate: notBlank('Title is required') }),
  fields.text('subtitle', 'Subtitle', { span: 2 }),
  fields.image('image_url', 'Image URL'),
  fields.text('cta_text', 'Button text', { placeholder: 'See more' }),
  fields.url('cta_url', 'Button URL'),
  fields.number('priority', 'Priority', { step: 1, defaultValue: 0, help: 'Higher shows first.' }),
  fields.bool('active', 'Active', { defaultValue: true }),
];

export default function TonightCards() {
  return (
    <CrudSection
      title="Tonight cards"
      description="Promo cards that appear in the Trip Swipe deck."
      resource={promoCardsResource}
      labelFor={(row) => row.title}
      createLabel="Add card"
      modalSize="lg"
      emptyTitle="No tonight cards"
      emptyDescription="Add a card to show a promo in the deck."
      searchPlaceholder="Search cards…"
      columns={[
        columns.thumb('image_url'),
        columns.primary('title', 'Card', 'subtitle'),
        columns.text('cta_text', 'Button'),
        columns.number('priority', 'Priority'),
        columns.bool('active', 'Active'),
      ]}
      formSchema={schema}
      fromFormValues={blankToNull}
      initialSort={{ key: 'priority', direction: 'desc' }}
    />
  );
}
