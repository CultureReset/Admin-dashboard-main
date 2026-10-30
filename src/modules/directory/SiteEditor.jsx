/**
 * Site editor — hero and category tiles for the public GCR site.
 *
 * The legacy dashboard used /api/admin/gcr/site-config and
 * /api/admin/gcr/category-cards. Neither route exists in gcr-api-clean, so
 * both panels below report that honestly instead of showing a form that
 * silently fails to save.
 *
 * The third panel does work: page rails are the live mechanism for curating
 * what appears on each public page, so it links there.
 */

import { Link } from 'react-router-dom';
import { Card, Notice, PageHeader } from '../../ui/primitives.jsx';
import { ConfigCard } from '../../components/ConfigCard.jsx';
import { CrudSection } from '../../ui/CrudSection.jsx';
import { createResource } from '../../api/createResource.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, fields } from '../../lib/fields.jsx';
import { GCR_PAGES } from './entitySchema.js';

const heroSchema = {
  groups: [
    {
      title: 'Hero',
      fields: [
        fields.text('headline', 'Headline', { span: 2 }),
        fields.text('subheadline', 'Subheadline', { span: 2 }),
        fields.image('background_image_url', 'Background image'),
        fields.text('cta_text', 'Button text'),
        fields.url('cta_url', 'Button URL'),
      ],
    },
  ],
};

const categoryCardsResource = createResource({
  name: 'Category tile',
  listPath: () => endpoints.categoryCards.list(),
  createPath: () => endpoints.categoryCards.create(),
  itemPath: (id) => endpoints.categoryCards.item(id),
  listKeys: ['cards'],
  itemKeys: ['card'],
});

const cardSchema = [
  fields.text('title', 'Title', { required: true, span: 2 }),
  fields.select('page', 'Page', GCR_PAGES),
  fields.text('category', 'Category'),
  fields.image('image_url', 'Image URL'),
  fields.url('link_url', 'Link URL'),
  fields.sortOrder(),
  fields.bool('is_active', 'Active', { defaultValue: true }),
];

export default function SiteEditor() {
  return (
    <>
      <PageHeader
        title="Site editor"
        description="Hero content and category tiles for the public GCR site."
      />

      <Notice tone="info" title="Backed by the API">
        The hero is a row in <code className="mono">platform_settings</code> under the{' '}
        <code className="mono">site_hero</code> key; the tiles are the{' '}
        <code className="mono">category_cards</code> table. For rails and ordering on a public
        page, use <Link to="/content/rails">Page Rails</Link>.
      </Notice>

      <div style={{ height: 'var(--space-5)' }} />

      <div className="stack">
        <ConfigCard
          title="Homepage hero"
          subtitle="Headline, image, and call to action."
          schema={heroSchema}
          getPath={() => endpoints.settings.get(endpoints.settingsKeys.siteHero)}
          responseKeys={['value']}
        />

        <CrudSection
          title="Category tiles"
          description="The tiles linking to each category page."
          resource={categoryCardsResource}
          labelFor={(row) => row.title}
          createLabel="Add tile"
          emptyTitle="No category tiles"
          columns={[
            columns.thumb('image_url'),
            columns.primary('title', 'Tile'),
            columns.text('page', 'Page'),
            columns.text('category', 'Category'),
            columns.number('sort_order', 'Order'),
            columns.bool('is_active', 'Active'),
          ]}
          formSchema={cardSchema}
        />

        <Card
          title="Page rails"
          subtitle="The supported way to curate public pages."
          actions={
            <Link to="/content/rails" className="ui-btn ui-btn--primary ui-btn--sm">
              Open page rails
            </Link>
          }
        >
          <p className="muted">
            Rails control the carousels on every public page — manual rails hold businesses you pin
            by hand, algorithmic rails fill themselves. This is fully wired to the API.
          </p>
        </Card>
      </div>
    </>
  );
}
