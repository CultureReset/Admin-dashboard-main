/**
 * Entity field descriptors.
 *
 * Mirrors the `entity` table in the GCR schema (gcr-api-clean/schema.sql).
 * Grouped the way an admin thinks about a business rather than the order the
 * columns happen to appear in.
 *
 * Because this is data, the Entity Editor's Info tab, the "create business"
 * modal, and the SEO screen all render from the same source — there is no
 * second copy of the field list to drift out of sync.
 */

import { fields, PRICE_RANGES } from '../../lib/fields.jsx';

/**
 * entity_type is a CHECK constraint in the schema — these are the only values
 * the database accepts, so the list is fixed by the API, not a UI choice.
 */
export const ENTITY_TYPES = [
  'restaurant',
  'coffee',
  'dessert',
  'bakery',
  'activity',
  'service',
  'shopping',
  'hotel',
  'condo',
  'vacation-rental',
  'park',
];

/** Pages an entity can additionally appear on (`also_appears_on`). */
export const GCR_PAGES = [
  { value: 'restaurants', label: 'Restaurants' },
  { value: 'coffee-sweets', label: 'Coffee & Sweets' },
  { value: 'things-to-do', label: 'Things To Do' },
  { value: 'services', label: 'Services' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'staying', label: 'Staying' },
  { value: 'public-spots', label: 'Public Spots' },
];

/** Boolean feature columns on `entity`, grouped for the Features tab. */
export const FEATURE_FLAGS = [
  {
    title: 'Service',
    flags: [
      ['serves_breakfast', 'Breakfast'],
      ['serves_brunch', 'Brunch'],
      ['serves_lunch', 'Lunch'],
      ['serves_dinner', 'Dinner'],
      ['dine_in', 'Dine in'],
      ['takeout', 'Takeout'],
      ['delivery', 'Delivery'],
      ['reservable', 'Takes reservations'],
    ],
  },
  {
    title: 'Bar',
    flags: [
      ['serves_beer', 'Beer'],
      ['serves_wine', 'Wine'],
      ['serves_cocktails', 'Cocktails'],
    ],
  },
  {
    title: 'Atmosphere',
    flags: [
      ['outdoor_seating', 'Outdoor seating'],
      ['live_music', 'Live music'],
      ['good_for_groups', 'Good for groups'],
      ['good_for_kids', 'Good for kids'],
      ['pet_friendly', 'Pet friendly'],
    ],
  },
  {
    title: 'Property',
    flags: [
      ['pool', 'Pool'],
      ['parking', 'Parking'],
    ],
  },
];

/** Flat list of every boolean flag name — used to build the payload. */
export const FEATURE_FLAG_NAMES = FEATURE_FLAGS.flatMap((g) => g.flags.map(([name]) => name));

/** The Info tab / create form. */
export const entityInfoSchema = {
  groups: [
    {
      title: 'Identity',
      fields: [
        fields.text('name', 'Business name', { required: true }),
        fields.text('slug', 'Slug', {
          required: true,
          help: 'URL segment. Lowercase, hyphenated. Changing this changes the public URL.',
          validate: (value) =>
            value && !/^[a-z0-9-]+$/.test(value)
              ? 'Use lowercase letters, numbers, and hyphens only'
              : null,
        }),
        fields.text('subtitle', 'Subtitle'),
        fields.select('entity_type', 'Primary type', ENTITY_TYPES, {
          help: 'Controls which page the business appears on. Constrained by the database.',
        }),
        fields.text('entity_subtype', 'Subtype', { placeholder: 'e.g. seafood, kayak tours' }),
        fields.text('icon', 'Icon', { placeholder: 'emoji or icon name' }),
        fields.textarea('description', 'Description', { rows: 5 }),
        {
          name: 'also_appears_on',
          label: 'Also appears on',
          type: 'multiselect',
          options: GCR_PAGES,
          span: 'full',
          help: 'Extra pages beyond the primary type.',
        },
        fields.bool('is_active', 'Active', { checkboxLabel: 'Visible on the public site' }),
        fields.bool('featured', 'Featured'),
      ],
    },
    {
      title: 'Contact',
      fields: [
        fields.tel('phone', 'Phone'),
        fields.email('email', 'Email'),
        fields.url('website_url', 'Website'),
        fields.url('directions_url', 'Directions URL'),
        fields.url('call_url', 'Call URL'),
      ],
    },
    {
      title: 'Address',
      fields: [
        fields.text('address_line_1', 'Address line 1', { span: 2 }),
        fields.text('address_line_2', 'Address line 2', { span: 2 }),
        fields.text('city', 'City'),
        fields.text('state', 'State'),
        fields.text('zip', 'ZIP'),
        fields.number('latitude', 'Latitude', { step: 'any' }),
        fields.number('longitude', 'Longitude', { step: 'any' }),
      ],
    },
    {
      title: 'Booking & ordering',
      fields: [
        fields.url('booking_url', 'Booking URL'),
        fields.url('reservation_url', 'Reservation URL'),
        fields.url('order_url', 'Order URL'),
        fields.url('menu_url', 'Menu URL'),
        fields.text('menu_pin', 'Menu PIN', {
          help: 'PIN an owner uses to edit their own menu without an account.',
        }),
      ],
    },
    {
      title: 'Social',
      fields: [
        fields.url('social_instagram', 'Instagram'),
        fields.url('social_facebook', 'Facebook'),
        fields.url('social_tiktok', 'TikTok'),
      ],
    },
    {
      title: 'Imagery',
      fields: [
        fields.image('hero_image_url', 'Hero image URL'),
        fields.image('logo_url', 'Logo URL'),
      ],
    },
    {
      title: 'Reputation & pricing',
      fields: [
        fields.number('rating', 'Rating', {
          min: 0,
          max: 5,
          step: 0.1,
          help: '0–5, enforced by the database.',
          validate: (value) =>
            value != null && (value < 0 || value > 5) ? 'Rating must be between 0 and 5' : null,
        }),
        fields.number('review_count', 'Review count', { min: 0, step: 1 }),
        fields.select('price_range', 'Price range', PRICE_RANGES),
      ],
    },
    {
      title: 'Activity details',
      description: 'Used by things-to-do and tour listings.',
      fields: [
        fields.money('price_from', 'Price from'),
        fields.money('price_to', 'Price to'),
        fields.text('price_unit', 'Price unit', { placeholder: 'per person, per boat…' }),
        fields.text('duration_text', 'Duration text'),
        fields.text('duration_label', 'Duration label', { placeholder: 'Half Day' }),
        fields.number('capacity_min', 'Capacity min', { step: 1, min: 0 }),
        fields.number('capacity_max', 'Capacity max', { step: 1, min: 0 }),
        fields.number('minimum_age', 'Minimum age', { step: 1, min: 0 }),
        fields.number('booking_advance_days', 'Booking advance (days)', { step: 1, min: 0 }),
      ],
    },
    {
      title: 'Stay details',
      description: 'Used by hotel, condo, and vacation-rental listings.',
      fields: [
        fields.number('bedrooms_min', 'Bedrooms min', { step: 1, min: 0 }),
        fields.number('bedrooms_max', 'Bedrooms max', { step: 1, min: 0 }),
        fields.number('sleeps_min', 'Sleeps min', { step: 1, min: 0 }),
        fields.number('sleeps_max', 'Sleeps max', { step: 1, min: 0 }),
        fields.time('check_in_time', 'Check in'),
        fields.time('check_out_time', 'Check out'),
      ],
    },
    {
      title: 'Positioning',
      fields: [
        fields.text('known_for', 'Known for', { span: 'full' }),
        fields.textarea('what_makes_it_different', 'What makes it different', { rows: 3 }),
        fields.tags('highlights', 'Highlights'),
        fields.tags('good_for', 'Good for'),
        fields.tags('secondary_subtypes', 'Secondary subtypes'),
      ],
    },
  ],
};

/** The SEO screen. */
export const entitySeoSchema = {
  groups: [
    {
      title: 'Search',
      fields: [
        fields.tags('seo_keywords', 'SEO keywords', {
          span: 'full',
          help: 'Stored as a text[] on the entity row.',
        }),
        fields.text('known_for', 'Known for', { span: 'full' }),
        fields.textarea('description', 'Description', {
          rows: 5,
          help: 'Used as the meta description on the public page.',
        }),
      ],
    },
  ],
};

/** Happy-hour header fields — PUT /gcr/entities/:slug/happy-hour. */
export const happyHourSchema = [
  fields.text('hh_days', 'Days', { placeholder: 'Mon–Fri', span: 2 }),
  fields.time('hh_start', 'Starts'),
  fields.time('hh_end', 'Ends'),
  fields.textarea('hh_description', 'Description', { rows: 3 }),
];

/**
 * Only the columns the API accepts, so a stray UI-only key never reaches the
 * database. Built from the descriptors above plus the feature flags.
 */
export const ENTITY_WRITABLE_FIELDS = [
  ...entityInfoSchema.groups.flatMap((g) => g.fields.map((f) => f.name)),
  ...FEATURE_FLAG_NAMES,
  'seo_keywords',
];

/** Strip anything not writable before sending an entity payload. */
export function pickEntityFields(values) {
  const out = {};
  for (const key of ENTITY_WRITABLE_FIELDS) {
    if (values[key] !== undefined) out[key] = values[key];
  }
  return out;
}
