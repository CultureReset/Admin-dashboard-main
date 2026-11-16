/**
 * Entity Editor → Details.
 *
 * The GCR schema attaches a dozen small collections to an entity — pricing,
 * what's included, requirements, FAQs, schedules, team, policies, reviews,
 * blog posts, secondary hours — each with an identical route shape.
 *
 * They are declared as descriptors here and rendered by one CrudSection, so
 * the whole tab is a table rather than a dozen near-identical components.
 */

import { useState } from 'react';
import { CrudSection } from '../../../ui/CrudSection.jsx';
import { TabBar } from '../../../ui/Tabs.jsx';
import { columns, fields } from '../../../lib/fields.jsx';
import {
  pricingItemsResource,
  whatsIncludedResource,
  requirementsResource,
  faqsResource,
  schedulesResource,
  secondaryHoursResource,
  teamResource,
  entityReviewsResource,
  policiesResource,
  blogResource,
} from '../../../api/resources.js';

// Field names are the live columns of each table. The admin routes insert and
// update with the request body as-is, so a form field that is not a column
// fails the whole save. Where a table carries a legacy duplicate column
// (included_item / item_name, content / body…) the table falls back to it.
const optional = { omitWhenEmpty: true };
const SECONDARY_DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const COLLECTIONS = [
  {
    id: 'pricing',
    label: 'Pricing',
    resource: pricingItemsResource,
    labelFor: (row) => row.item_name || row.tier_name,
    columns: [
      columns.primary('item_name', 'Item', 'tier_name'),
      columns.money('price', 'Price'),
      columns.text('price_label', 'Unit'),
      columns.text('duration', 'Duration'),
      columns.text('description', 'Description'),
    ],
    schema: [
      fields.text('item_name', 'Item', { required: true }),
      fields.text('tier_name', 'Tier', optional),
      fields.money('price', 'Price'),
      fields.text('price_label', 'Unit', { placeholder: 'per person', ...optional }),
      fields.text('duration', 'Duration', { placeholder: '2 hours', ...optional }),
      fields.number('minimum_age', 'Minimum age', { min: 0, step: 1 }),
      fields.textarea('description', 'Description', { rows: 2 }),
      fields.sortOrder(),
    ],
  },
  {
    id: 'included',
    label: "What's included",
    resource: whatsIncludedResource,
    labelFor: (row) => row.item_name || row.included_item,
    columns: [
      {
        key: 'item_name',
        header: 'Item',
        render: (row) => row.item_name || row.included_item || <span className="faint">—</span>,
      },
      columns.text('icon', 'Icon'),
    ],
    schema: [
      fields.text('item_name', 'Item', { required: true }),
      fields.text('icon', 'Icon', { placeholder: '🎣', ...optional }),
      fields.sortOrder(),
    ],
  },
  {
    id: 'requirements',
    label: 'Requirements',
    resource: requirementsResource,
    labelFor: (row) => row.requirement_name || row.requirement_text,
    columns: [
      columns.primary('requirement_name', 'Requirement', 'applies_to'),
      columns.text('requirement_text', 'Detail'),
    ],
    schema: [
      fields.text('requirement_name', 'Requirement', { required: true }),
      fields.text('applies_to', 'Applies to', { placeholder: 'All guests', ...optional }),
      fields.textarea('requirement_text', 'Detail', { rows: 2 }),
      fields.sortOrder(),
    ],
  },
  {
    id: 'faqs',
    label: 'FAQs',
    resource: faqsResource,
    labelFor: (row) => row.question,
    columns: [
      columns.primary('question', 'Question', 'category'),
      columns.text('answer', 'Answer'),
    ],
    schema: [
      fields.text('question', 'Question', { required: true, span: 'full' }),
      fields.textarea('answer', 'Answer', { rows: 4, required: true }),
      fields.text('category', 'Category', optional),
      fields.sortOrder(),
    ],
  },
  {
    id: 'schedules',
    label: 'Schedules',
    resource: schedulesResource,
    labelFor: (row) => row.label || row.schedule_type,
    columns: [
      columns.primary('label', 'Schedule', 'schedule_type'),
      columns.text('time_start', 'Start'),
      columns.text('time_end', 'End'),
      columns.text('duration', 'Duration'),
      columns.text('days_of_week', 'Days'),
      columns.bool('is_active', 'Active'),
    ],
    schema: [
      fields.text('label', 'Label', { required: true }),
      fields.text('schedule_type', 'Type', { placeholder: 'morning trip', ...optional }),
      fields.time('time_start', 'Start time', optional),
      fields.time('time_end', 'End time', optional),
      fields.text('duration', 'Duration', { placeholder: '2 hours', ...optional }),
      fields.text('days_of_week', 'Days', { placeholder: 'Mon,Wed,Fri', ...optional }),
      fields.textarea('notes', 'Notes', { rows: 2 }),
      fields.bool('is_active', 'Active', { defaultValue: true }),
      fields.sortOrder(),
    ],
  },
  {
    id: 'secondary-hours',
    label: 'Secondary hours',
    resource: secondaryHoursResource,
    labelFor: (row) => row.hours_type || row.description,
    columns: [
      columns.primary('hours_type', 'Hours for', 'description'),
      {
        key: 'day_of_week',
        header: 'Day',
        render: (row) =>
          SECONDARY_DAYS.find((d) => d.value === Number(row.day_of_week))?.label || <span className="faint">—</span>,
      },
      columns.text('opens_at', 'Opens'),
      columns.text('closes_at', 'Closes'),
      columns.bool('is_closed', 'Closed'),
    ],
    schema: [
      fields.text('hours_type', 'Hours for', { required: true, placeholder: 'Kitchen, Bar, Pool…' }),
      fields.select('day_of_week', 'Day', SECONDARY_DAYS, {
        required: true,
        transform: (value) => (value === '' || value == null ? null : Number(value)),
      }),
      fields.time('opens_at', 'Opens', optional),
      fields.time('closes_at', 'Closes', optional),
      fields.bool('is_closed', 'Closed this day'),
      fields.text('description', 'Description', optional),
    ],
  },
  {
    id: 'team',
    label: 'Team',
    resource: teamResource,
    labelFor: (row) => row.name,
    columns: [
      columns.thumb('photo_url'),
      columns.primary('name', 'Name', 'title'),
      columns.text('specialty', 'Specialty'),
      columns.text('bio', 'Bio'),
    ],
    schema: [
      fields.text('name', 'Name', { required: true }),
      fields.text('title', 'Role', optional),
      fields.text('specialty', 'Specialty', optional),
      fields.number('years_experience', 'Years of experience', { min: 0, step: 1 }),
      fields.textarea('bio', 'Bio', { rows: 3 }),
      fields.image('photo_url', 'Photo URL'),
      fields.sortOrder(),
    ],
  },
  {
    id: 'reviews',
    label: 'Reviews',
    resource: entityReviewsResource,
    labelFor: (row) => row.reviewer_name || 'Review',
    columns: [
      columns.primary('reviewer_name', 'Reviewer', 'source_system'),
      columns.number('rating', 'Rating'),
      columns.text('body', 'Review'),
      columns.bool('approved', 'Public'),
      columns.date('created_at', 'Date'),
    ],
    // entity_reviews columns; rating is an integer constrained to 1–5.
    schema: [
      fields.text('reviewer_name', 'Reviewer', { required: true }),
      fields.number('rating', 'Rating (1–5)', { required: true, min: 1, max: 5, step: 1 }),
      fields.text('title', 'Title'),
      fields.text('source_system', 'Source', { placeholder: 'Google, Yelp…', omitWhenEmpty: true }),
      fields.textarea('body', 'Review', { rows: 4 }),
      fields.bool('approved', 'Approved for public display', { defaultValue: true }),
    ],
  },
  {
    id: 'policies',
    label: 'Policies',
    resource: policiesResource,
    labelFor: (row) => row.title || row.policy_type || row.type,
    columns: [
      columns.primary('title', 'Policy', 'policy_type'),
      {
        key: 'body',
        header: 'Detail',
        render: (row) => row.body || row.content || <span className="faint">—</span>,
      },
    ],
    schema: [
      fields.text('title', 'Policy', { required: true }),
      fields.text('policy_type', 'Type', { placeholder: 'cancellation', ...optional }),
      fields.textarea('body', 'Detail', { rows: 4 }),
    ],
  },
  {
    id: 'blog',
    label: 'Blog',
    resource: blogResource,
    labelFor: (row) => row.title,
    columns: [
      { ...columns.thumb('cover_url'), render: (row) => columns.thumb('cover_url').render({ cover_url: row.cover_url || row.featured_image_url }) },
      columns.primary('title', 'Title', 'slug'),
      columns.date('published_at', 'Published'),
    ],
    schema: [
      fields.text('title', 'Title', { required: true, span: 2 }),
      fields.text('slug', 'Slug', optional),
      fields.textarea('excerpt', 'Excerpt', { rows: 2 }),
      fields.textarea('body', 'Body', { rows: 10 }),
      fields.image('cover_url', 'Cover image URL'),
      fields.datetime('published_at', 'Published at', optional),
    ],
  },
];

export default function CollectionsTab({ slug }) {
  const [active, setActive] = useState(COLLECTIONS[0].id);
  const collection = COLLECTIONS.find((c) => c.id === active) || COLLECTIONS[0];

  return (
    <div className="stack">
      <TabBar
        tabs={COLLECTIONS.map((t) => ({ id: t.id, label: t.label }))}
        activeId={active}
        onChange={setActive}
      />

      <CrudSection
        // Remount on switch so table state (search, page) does not leak across
        // collections with different shapes.
        key={collection.id}
        title={collection.label}
        description={`Attached to this business.`}
        resource={collection.resource}
        params={{ slug }}
        columns={collection.columns}
        formSchema={collection.schema}
        labelFor={collection.labelFor}
        createLabel={`Add ${collection.label.toLowerCase()}`}
        emptyTitle={`No ${collection.label.toLowerCase()}`}
        modalSize="lg"
      />
    </div>
  );
}
