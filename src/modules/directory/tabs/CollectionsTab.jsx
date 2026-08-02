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

const COLLECTIONS = [
  {
    id: 'pricing',
    label: 'Pricing',
    resource: pricingItemsResource,
    labelFor: (row) => row.label || row.item_name || 'Pricing item',
    columns: [
      columns.primary('label', 'Label'),
      columns.money('price', 'Price'),
      columns.text('price_unit', 'Unit'),
      columns.text('description', 'Description'),
    ],
    schema: [
      fields.text('label', 'Label', { required: true, span: 2 }),
      fields.money('price', 'Price'),
      fields.text('price_unit', 'Unit', { placeholder: 'per person' }),
      fields.textarea('description', 'Description', { rows: 2 }),
      fields.sortOrder(),
    ],
  },
  {
    id: 'whats-included',
    label: "What's included",
    resource: whatsIncludedResource,
    labelFor: (row) => row.item_name || row.label,
    columns: [columns.primary('item_name', 'Item'), columns.text('description', 'Description')],
    schema: [
      fields.text('item_name', 'Item', { required: true, span: 2 }),
      fields.textarea('description', 'Description', { rows: 2 }),
      fields.sortOrder(),
    ],
  },
  {
    id: 'requirements',
    label: 'Requirements',
    resource: requirementsResource,
    labelFor: (row) => row.requirement || row.item_name,
    columns: [columns.primary('requirement', 'Requirement'), columns.text('description', 'Detail')],
    schema: [
      fields.text('requirement', 'Requirement', { required: true, span: 2 }),
      fields.textarea('description', 'Detail', { rows: 2 }),
      fields.sortOrder(),
    ],
  },
  {
    id: 'faqs',
    label: 'FAQs',
    resource: faqsResource,
    labelFor: (row) => row.question,
    columns: [columns.primary('question', 'Question'), columns.text('answer', 'Answer')],
    schema: [
      fields.text('question', 'Question', { required: true, span: 'full' }),
      fields.textarea('answer', 'Answer', { rows: 4, required: true }),
      fields.sortOrder(),
    ],
  },
  {
    id: 'schedules',
    label: 'Schedules',
    resource: schedulesResource,
    labelFor: (row) => row.schedule_name || row.label,
    columns: [
      columns.primary('schedule_name', 'Schedule'),
      columns.text('time_start', 'Start'),
      columns.text('duration', 'Duration'),
      columns.text('days_of_week', 'Days'),
    ],
    schema: [
      fields.text('schedule_name', 'Name', { required: true, span: 2 }),
      fields.text('label', 'Label'),
      fields.text('schedule_type', 'Type'),
      fields.time('time_start', 'Start time'),
      fields.text('duration', 'Duration', { placeholder: '2 hours' }),
      fields.text('days_of_week', 'Days', { placeholder: 'Mon,Wed,Fri' }),
      fields.textarea('notes', 'Notes', { rows: 2 }),
      fields.bool('is_active', 'Active', { defaultValue: true }),
      fields.sortOrder(),
    ],
  },
  {
    id: 'secondary-hours',
    label: 'Secondary hours',
    resource: secondaryHoursResource,
    labelFor: (row) => row.label || row.name,
    columns: [
      columns.primary('label', 'Label'),
      columns.text('opens_at', 'Opens'),
      columns.text('closes_at', 'Closes'),
      columns.text('days_of_week', 'Days'),
    ],
    schema: [
      fields.text('label', 'Label', { required: true, span: 2, placeholder: 'Kitchen, Bar, Pool…' }),
      fields.time('opens_at', 'Opens'),
      fields.time('closes_at', 'Closes'),
      fields.text('days_of_week', 'Days'),
      fields.sortOrder(),
    ],
  },
  {
    id: 'team',
    label: 'Team',
    resource: teamResource,
    labelFor: (row) => row.name,
    columns: [
      columns.thumb('image_url'),
      columns.primary('name', 'Name', 'role'),
      columns.text('bio', 'Bio'),
    ],
    schema: [
      fields.text('name', 'Name', { required: true }),
      fields.text('role', 'Role'),
      fields.textarea('bio', 'Bio', { rows: 3 }),
      fields.image('image_url', 'Photo URL'),
      fields.sortOrder(),
    ],
  },
  {
    id: 'reviews',
    label: 'Reviews',
    resource: entityReviewsResource,
    labelFor: (row) => row.author_name || row.reviewer_name || 'Review',
    columns: [
      columns.primary('author_name', 'Author'),
      columns.number('rating', 'Rating'),
      columns.text('review_text', 'Review'),
      columns.date('review_date', 'Date'),
    ],
    schema: [
      fields.text('author_name', 'Author', { required: true }),
      fields.number('rating', 'Rating', { min: 0, max: 5, step: 0.5 }),
      fields.textarea('review_text', 'Review', { rows: 4 }),
      fields.date('review_date', 'Date'),
      fields.text('source', 'Source', { placeholder: 'Google, Yelp…' }),
    ],
  },
  {
    id: 'policies',
    label: 'Policies',
    resource: policiesResource,
    labelFor: (row) => row.policy_name || row.title,
    columns: [columns.primary('policy_name', 'Policy'), columns.text('policy_text', 'Detail')],
    schema: [
      fields.text('policy_name', 'Policy', { required: true, span: 2 }),
      fields.textarea('policy_text', 'Detail', { rows: 4 }),
      fields.sortOrder(),
    ],
  },
  {
    id: 'blog',
    label: 'Blog',
    resource: blogResource,
    labelFor: (row) => row.title,
    columns: [
      columns.thumb('image_url'),
      columns.primary('title', 'Title', 'slug'),
      columns.date('published_at', 'Published'),
    ],
    schema: [
      fields.text('title', 'Title', { required: true, span: 2 }),
      fields.text('slug', 'Slug'),
      fields.textarea('excerpt', 'Excerpt', { rows: 2 }),
      fields.textarea('body', 'Body', { rows: 10 }),
      fields.image('image_url', 'Image URL'),
      fields.datetime('published_at', 'Published at'),
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
