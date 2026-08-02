/**
 * Field schemas for the content tables, mirroring the GCR schema.
 *
 * Defined once and reused by the global Events/Specials screens, the Entity
 * Editor's Content tab, and the bulk-import previews, so the three can never
 * disagree about what a row looks like.
 */

import { fields, DAYS_OF_WEEK } from './fields.jsx';

/** entity_events */
export const eventSchema = {
  groups: [
    {
      title: 'Event',
      fields: [
        fields.text('event_name', 'Event name', { required: true, span: 2 }),
        fields.textarea('description', 'Description', { rows: 3 }),
        fields.date('event_date', 'Date'),
        fields.time('start_time', 'Start time'),
        fields.time('end_time', 'End time'),
        fields.select('day_of_week', 'Day of week', DAYS_OF_WEEK),
        fields.bool('recurring', 'Recurring', { checkboxLabel: 'Repeats weekly' }),
        fields.money('cover_charge', 'Cover charge'),
      ],
    },
    {
      title: 'Performer & media',
      fields: [
        fields.text('artist_name', 'Artist name'),
        fields.image('image_url', 'Image URL'),
      ],
    },
    {
      title: 'Visibility',
      fields: [fields.bool('is_active', 'Active', { defaultValue: true })],
    },
  ],
};

/** entity_specials */
export const specialSchema = {
  groups: [
    {
      title: 'Special',
      fields: [
        fields.text('special_name', 'Special name', { required: true, span: 2 }),
        fields.textarea('description', 'Description', { rows: 3 }),
        fields.text('discount_text', 'Discount text', {
          span: 2,
          placeholder: 'e.g. Half off appetizers',
          help: 'Free-text shown on the card. Use the fields below for a structured discount.',
        }),
        fields.select('discount_type', 'Discount type', [
          { value: 'percent', label: 'Percent off' },
          { value: 'amount', label: 'Amount off' },
          { value: 'fixed', label: 'Fixed price' },
        ]),
        fields.number('discount_value', 'Discount value', { step: '0.01', min: 0 }),
      ],
    },
    {
      title: 'When',
      fields: [
        fields.text('days', 'Days', { placeholder: 'Mon–Fri' }),
        fields.select('day_of_week', 'Day of week', DAYS_OF_WEEK),
        fields.time('start_time', 'Start time'),
        fields.time('end_time', 'End time'),
        fields.date('start_date', 'Start date'),
        fields.date('end_date', 'End date'),
      ],
    },
    {
      title: 'Media & visibility',
      fields: [
        fields.image('image_url', 'Image URL'),
        fields.bool('is_active', 'Active', { defaultValue: true }),
      ],
    },
  ],
};

/** menu_items */
export const menuItemSchema = {
  groups: [
    {
      title: 'Item',
      fields: [
        fields.text('item_name', 'Item name', { required: true, span: 2 }),
        fields.textarea('description', 'Description', { rows: 3 }),
        fields.money('price', 'Price'),
        fields.bool('has_market_price', 'Market price', {
          checkboxLabel: 'Show “market price” instead of a number',
        }),
        fields.tags('tags', 'Tags', { placeholder: 'gluten-free, spicy' }),
        fields.image('image_url', 'Image URL'),
      ],
    },
    {
      title: 'Flags',
      fields: [
        fields.bool('is_available', 'Available', { defaultValue: true }),
        fields.bool('is_featured', 'Featured'),
        fields.bool('is_catch_of_day', 'Catch of the day'),
        fields.bool('is_on_tap', 'On tap'),
        fields.sortOrder(),
      ],
    },
  ],
};

/** drink_items */
export const drinkItemSchema = [
  fields.text('item_name', 'Drink name', { required: true, span: 2 }),
  fields.textarea('description', 'Description', { rows: 2 }),
  fields.money('price', 'Price'),
  fields.image('image_url', 'Image URL'),
];

/** happy_hour_items */
export const happyHourItemSchema = [
  fields.text('item_name', 'Item name', { required: true, span: 2 }),
  fields.textarea('description', 'Description', { rows: 2 }),
  fields.money('price', 'Happy hour price'),
  fields.money('original_price', 'Regular price'),
  fields.image('image_url', 'Image URL'),
];

/** Extra fields on a menu section — day/time windows for e.g. a lunch menu. */
export const menuSectionExtraFields = [
  fields.days('days_of_week', 'Available days'),
  fields.time('start_time', 'Available from'),
  fields.time('end_time', 'Available until'),
  fields.bool('is_active', 'Active', { defaultValue: true }),
];
