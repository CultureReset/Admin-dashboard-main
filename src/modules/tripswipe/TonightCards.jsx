/**
 * Tonight cards — date-scoped promo cards in the Trip Swipe deck.
 *
 * GET/POST /api/admin/tripswipe/promo-cards
 * PUT/DELETE /api/admin/tripswipe/promo-cards/:id
 */

import { CrudSection } from '../../ui/CrudSection.jsx';
import { promoCardsResource } from '../../api/resources.js';
import { columns, fields } from '../../lib/fields.jsx';

const schema = [
  fields.text('title', 'Title', { required: true, span: 2 }),
  fields.textarea('description', 'Description', { rows: 3 }),
  fields.image('image_url', 'Image URL'),
  fields.text('cta_text', 'Button text', { placeholder: 'See more' }),
  fields.url('cta_url', 'Button URL'),
  fields.date('show_date', 'Show on date', {
    required: true,
    help: 'The card appears in the deck only on this date.',
  }),
  fields.bool('is_active', 'Active', { defaultValue: true }),
];

export default function TonightCards() {
  return (
    <CrudSection
      title="Tonight cards"
      description="Promo cards that appear in the deck on a specific date."
      resource={promoCardsResource}
      labelFor={(row) => row.title}
      createLabel="Add card"
      modalSize="lg"
      emptyTitle="No tonight cards"
      emptyDescription="Add a card and give it a date to schedule it."
      searchPlaceholder="Search cards…"
      columns={[
        columns.thumb('image_url'),
        columns.primary('title', 'Card'),
        columns.text('description', 'Description'),
        columns.date('show_date', 'Shows on'),
        columns.bool('is_active', 'Active'),
      ]}
      formSchema={schema}
      initialSort={{ key: 'show_date', direction: 'desc' }}
    />
  );
}
