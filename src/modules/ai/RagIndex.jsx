/**
 * AI index / RAG.
 *
 * GET  /api/admin/rag-status
 * POST /api/admin/gcr/reindex/:slug
 */

import { useState } from 'react';
import { Badge, Button, Card, ErrorState, LoadingBlock, PageHeader, Stat } from '../../ui/primitives.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { EntityPicker, useEntities } from '../../components/EntityPicker.jsx';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { formatDateTime, formatNumber } from '../../lib/fields.jsx';

export default function RagIndex() {
  const toast = useToast();
  const { entities } = useEntities();
  const [slug, setSlug] = useState(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [bulkProgress, setBulkProgress] = useState(null);

  const { data, loading, error, reload } = useAsync(
    async () => api.get(endpoints.ai.ragStatus()),
    [],
    { initialData: null },
  );

  const reindexOne = async (targetSlug) => {
    const response = await api.post(endpoints.entities.reindex(targetSlug));
    return {
      slug: targetSlug,
      name: response?.name || targetSlug,
      chunks: response?.chunks_indexed ?? 0,
      status: response?.embedding_status || 'queued',
      at: new Date().toISOString(),
    };
  };

  const runOne = async () => {
    if (!slug) {
      toast.warning('Pick a business to reindex.');
      return;
    }
    setRunning(true);
    try {
      const entry = await reindexOne(slug);
      setLog((prev) => [entry, ...prev].slice(0, 50));
      toast.success(`${entry.name}: ${entry.chunks} chunks, ${entry.status}.`, 'Reindexed');
      await reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setRunning(false);
    }
  };

  /**
   * Reindex every active listing, one request at a time. Sequential on
   * purpose — this hits an embedding pipeline and firing hundreds of parallel
   * requests at it is how you get rate-limited.
   */
  const runAll = async () => {
    const targets = entities.filter((entity) => entity.is_active);
    if (targets.length === 0) return;
    setRunning(true);
    setBulkProgress({ done: 0, total: targets.length, failed: 0 });
    try {
      let failed = 0;
      for (const [index, entity] of targets.entries()) {
        try {
          const entry = await reindexOne(entity.slug);
          setLog((prev) => [entry, ...prev].slice(0, 50));
        } catch {
          failed += 1;
        }
        setBulkProgress({ done: index + 1, total: targets.length, failed });
      }
      toast.success(
        `Reindexed ${targets.length - failed} of ${targets.length} listings.`,
        'Bulk reindex complete',
      );
      await reload();
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <PageHeader
        title="AI index / RAG"
        description="Push entity content into the retrieval store so the concierge can answer from it."
        actions={<Button onClick={reload} disabled={loading}>Refresh status</Button>}
      />

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <LoadingBlock />}

      {!loading && !error && data && (
        <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
          {Object.entries(data)
            .filter(([, value]) => typeof value !== 'object')
            .map(([key, value]) => (
              <Stat
                key={key}
                label={key.replace(/_/g, ' ')}
                value={typeof value === 'number' ? formatNumber(value) : String(value)}
              />
            ))}
        </div>
      )}

      <div className="stack">
        <Card
          title="Reindex a business"
          subtitle="Rebuilds the embeddings for one listing."
          actions={
            <>
              <Button variant="primary" loading={running && !bulkProgress} onClick={runOne} disabled={!slug}>
                Reindex
              </Button>
              <Button loading={running && Boolean(bulkProgress)} onClick={runAll}>
                Reindex all active
              </Button>
            </>
          }
        >
          <EntityPicker value={slug} onChange={setSlug} label="Business" />
          {bulkProgress && (
            <>
              <div style={{ height: 'var(--space-4)' }} />
              <p className="muted">
                {bulkProgress.done} of {bulkProgress.total} done
                {bulkProgress.failed ? ` · ${bulkProgress.failed} failed` : ''}
              </p>
            </>
          )}
        </Card>

        {log.length > 0 && (
          <Card title="This session" subtitle="Reindex results since the page loaded.">
            <ul className="sec-editor__items">
              {log.map((entry, index) => (
                <li className="sec-editor__item" key={`${entry.slug}-${index}`}>
                  <div className="sec-editor__itembody">
                    <div className="sec-editor__itemname">
                      {entry.name}
                      <Badge tone={entry.status === 'pending' ? 'warning' : 'success'}>{entry.status}</Badge>
                    </div>
                    <div className="sec-editor__itemdesc mono">
                      {entry.slug} · {entry.chunks} chunks · {formatDateTime(entry.at)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
