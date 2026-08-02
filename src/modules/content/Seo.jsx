/**
 * Tags & SEO.
 *
 * Per-entity SEO fields (seo_keywords, known_for, description) written through
 * the entity PATCH, plus a directory-wide view of which listings are missing
 * the fields that matter for search.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, LoadingBlock, ErrorState, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { EntityPicker, useEntities } from '../../components/EntityPicker.jsx';
import { useEntityRecord } from '../directory/useEntityRecord.js';
import { entitySeoSchema } from '../directory/entitySchema.js';
import { columns } from '../../lib/fields.jsx';
import { usePersistentState } from '../../hooks/useAsync.js';

export default function Seo() {
  const navigate = useNavigate();
  const { entities, loading, error, reload } = useEntities();
  const [slug, setSlug] = usePersistentState('cc_admin_entity', null);
  const [showGapsOnly, setShowGapsOnly] = useState(true);

  const { entity, loading: entityLoading, error: entityError, patch, reload: reloadEntity } =
    useEntityRecord(slug);

  // The list payload carries only a summary of each entity, so "missing
  // description" here means missing from that summary — enough to triage.
  const audit = useMemo(
    () =>
      entities.map((item) => {
        const gaps = [];
        if (!item.hero_image_url) gaps.push('hero image');
        if (!item.entity_subtype) gaps.push('subtype');
        if (!item.city) gaps.push('city');
        if (!item.rating) gaps.push('rating');
        return { ...item, __gaps: gaps, __gapCount: gaps.length };
      }),
    [entities],
  );

  const rows = useMemo(
    () => (showGapsOnly ? audit.filter((row) => row.__gapCount > 0) : audit),
    [audit, showGapsOnly],
  );

  const complete = audit.length - audit.filter((row) => row.__gapCount > 0).length;

  return (
    <>
      <PageHeader
        title="Tags & SEO"
        description="Search metadata per business, and a directory-wide check for missing fields."
        actions={<Button onClick={reload} disabled={loading}>Refresh</Button>}
      />

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="Listings" value={audit.length} />
        <Stat label="Complete" value={complete} tone="success" />
        <Stat
          label="Needs attention"
          value={audit.length - complete}
          tone={audit.length - complete ? 'warning' : 'neutral'}
        />
      </div>

      <div className="stack">
        <Card title="Edit search metadata" subtitle="Written to the entity row.">
          <div className="stack">
            <EntityPicker value={slug} onChange={setSlug} label="Business" />
            {slug && entityLoading && <LoadingBlock />}
            {slug && entityError && <ErrorState error={entityError} onRetry={reloadEntity} />}
            {slug && entity && !entityLoading && (
              <SchemaForm
                schema={entitySeoSchema}
                initialValues={entity}
                columns={1}
                onSubmit={(values) => patch({ entity: values })}
                submitLabel="Save SEO fields"
              />
            )}
            {!slug && <p className="muted">Pick a business to edit its keywords and description.</p>}
          </div>
        </Card>

        <Card padded={false} title="Directory audit">
          <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
            <DataTable
              columns={[
                columns.thumb('hero_image_url'),
                columns.primary('name', 'Business', 'slug'),
                columns.text('entity_subtype', 'Subtype'),
                columns.text('city', 'City'),
                {
                  key: '__gaps',
                  header: 'Missing',
                  render: (row) =>
                    row.__gaps.length === 0 ? (
                      <Badge tone="success">Complete</Badge>
                    ) : (
                      <span className="row-wrap" style={{ gap: 4 }}>
                        {row.__gaps.map((gap) => (
                          <Badge tone="warning" key={gap}>{gap}</Badge>
                        ))}
                      </span>
                    ),
                },
                {
                  key: '__actions',
                  header: '',
                  align: 'right',
                  sortable: false,
                  searchable: false,
                  stopPropagation: true,
                  render: (row) => (
                    <span className="ui-cell-actions">
                      <Button size="sm" onClick={() => setSlug(row.slug)}>Select</Button>
                      <Button
                        size="sm"
                        onClick={() => navigate(`/directory/entity/${encodeURIComponent(row.slug)}`)}
                      >
                        Open
                      </Button>
                    </span>
                  ),
                },
              ]}
              rows={rows}
              loading={loading}
              error={error}
              onRetry={reload}
              rowKey="slug"
              searchPlaceholder="Search businesses…"
              emptyTitle={showGapsOnly ? 'Everything looks complete' : 'No businesses'}
              initialSort={{ key: '__gapCount', direction: 'desc' }}
              toolbar={
                <label className="row" style={{ gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={showGapsOnly}
                    onChange={(e) => setShowGapsOnly(e.target.checked)}
                  />
                  <span>Only show listings with gaps</span>
                </label>
              }
            />
          </div>
        </Card>
      </div>
    </>
  );
}
