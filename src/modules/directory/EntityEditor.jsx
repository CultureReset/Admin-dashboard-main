/**
 * Entity Editor.
 *
 * Picks an entity (or reads one from the URL), loads it once, and hands the
 * record to whichever tab is active. Every tab shares the same record and the
 * same `patch` function, so a save on one tab refreshes the others.
 *
 * Routes: /directory/entity  and  /directory/entity/:slug
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, ErrorState, LoadingBlock, PageHeader } from '../../ui/primitives.jsx';
import { Tabs } from '../../ui/Tabs.jsx';
import { EntityPicker, useEntities } from '../../components/EntityPicker.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { useEntityRecord } from './useEntityRecord.js';
import { entityTabs } from './tabs/index.js';
import { usePersistentState } from '../../hooks/useAsync.js';

export default function EntityEditor() {
  const { slug: slugFromUrl } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { selectedSlug, setSelectedSlug } = useEntities();
  const [activeTab, setActiveTab] = usePersistentState('cc_admin_entity_tab', 'info');
  const [reindexing, setReindexing] = useState(false);

  // The URL wins when present; otherwise fall back to the shared selection.
  const slug = slugFromUrl || selectedSlug || null;

  // Keep the shared selection in step so other sections open on the same
  // business the admin was just editing.
  useEffect(() => {
    if (slugFromUrl && slugFromUrl !== selectedSlug) setSelectedSlug(slugFromUrl);
  }, [slugFromUrl, selectedSlug, setSelectedSlug]);

  const { record, entity, loading, error, saving, reload, patch } = useEntityRecord(slug);

  const choose = (nextSlug) => {
    setSelectedSlug(nextSlug);
    navigate(nextSlug ? `/directory/entity/${encodeURIComponent(nextSlug)}` : '/directory/entity');
  };

  const reindex = async () => {
    setReindexing(true);
    try {
      const result = await api.post(endpoints.entities.reindex(slug));
      toast.success(
        result?.chunks_indexed != null
          ? `Reindex queued — ${result.chunks_indexed} chunks, status ${result.embedding_status || 'pending'}.`
          : 'Reindex queued.',
        'AI index',
      );
    } catch (err) {
      toast.error(err);
    } finally {
      setReindexing(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Entity Editor"
        description="Everything about one business: information, hours, photos, tags, content, and page placement."
        actions={
          slug && (
            <>
              <Button onClick={reload} disabled={loading}>Refresh</Button>
              <Button onClick={reindex} loading={reindexing}>Reindex for AI</Button>
              <Button onClick={() => navigate('/directory/businesses')}>All businesses</Button>
            </>
          )
        }
      />

      <div style={{ marginBottom: 'var(--space-5)', maxWidth: 460 }}>
        <EntityPicker value={slug} onChange={choose} label="Editing" />
      </div>

      {!slug && (
        <div className="entity-picker__prompt">Pick a business above to start editing.</div>
      )}

      {slug && loading && <LoadingBlock label="Loading business…" />}

      {slug && error && <ErrorState error={error} onRetry={reload} />}

      {slug && !loading && !error && entity && (
        <>
          <div className="row-wrap" style={{ marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontSize: 17 }}>{entity.name}</h2>
            <span className="mono faint">{entity.slug}</span>
            <Badge tone={entity.is_active ? 'success' : 'neutral'}>
              {entity.is_active ? 'Live' : 'Hidden'}
            </Badge>
            {entity.featured && <Badge tone="primary">Featured</Badge>}
            {entity.entity_type && <Badge tone="info">{entity.entity_type}</Badge>}
          </div>

          <Tabs
            tabs={entityTabs}
            activeId={activeTab}
            onChange={setActiveTab}
            context={{
              slug,
              entity,
              entityName: entity.name,
              record,
              reload,
              patch,
              saving,
            }}
          />
        </>
      )}

      {slug && !loading && !error && !entity && (
        <ErrorState
          error={{ message: `No entity found for slug “${slug}”.`, path: endpoints.entities.detail(slug) }}
          onRetry={reload}
        />
      )}
    </>
  );
}
