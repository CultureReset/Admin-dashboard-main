/**
 * AI settings.
 *
 * GET  /api/ai-provider                          provider registry
 * POST /api/admin/gcr/backfill-photo-analysis    batch photo analysis
 * GET  /api/admin/repair-photos/status
 * POST /api/admin/repair-photos
 * POST /api/admin/gcr/rehost-photos              { entity_slug, urls }
 */

import { useState } from 'react';
import { Badge, Button, Card, ErrorState, LoadingBlock, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';

export default function AiSettings() {
  const toast = useToast();
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState(null);
  const [repairing, setRepairing] = useState(false);
  const [rehostSlug, setRehostSlug] = useState(null);
  const [rehostUrls, setRehostUrls] = useState('');
  const [rehosting, setRehosting] = useState(false);

  const providersQuery = useAsync(
    async () => api.get(endpoints.ai.providers()),
    [],
    { initialData: null },
  );

  const repairQuery = useAsync(
    async () => api.get(endpoints.photos.repairStatus()),
    [],
    { initialData: null },
  );

  /** The backfill route processes a batch per call and reports what remains. */
  const runBackfill = async () => {
    setBackfilling(true);
    try {
      const response = await api.post(endpoints.ai.backfillPhotoAnalysis());
      setBackfillResult(response);
      if (response?.processed === 0) {
        toast.info(response?.message || 'Nothing left to analyze.');
      } else {
        toast.success(
          `Analyzed ${response?.processed ?? 0} photos, ${response?.remaining ?? 0} remaining.`,
        );
      }
    } catch (err) {
      toast.error(err);
    } finally {
      setBackfilling(false);
    }
  };

  const runRepair = async () => {
    setRepairing(true);
    try {
      const response = await api.post(endpoints.photos.repair());
      toast.success(
        typeof response === 'object' ? JSON.stringify(response).slice(0, 160) : 'Repair started.',
        'Photo repair',
      );
      await repairQuery.reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setRepairing(false);
    }
  };

  const runRehost = async () => {
    const urls = rehostUrls
      .split(/[\n,]/)
      .map((url) => url.trim())
      .filter(Boolean);
    if (!rehostSlug || urls.length === 0) {
      toast.warning('Pick a business and paste at least one image URL.');
      return;
    }
    setRehosting(true);
    try {
      const response = await api.post(endpoints.photos.rehost(), {
        entity_slug: rehostSlug,
        urls,
      });
      toast.success(
        `${response?.stored ?? 0} stored, ${response?.failed ?? 0} failed of ${response?.requested ?? urls.length}.`,
        'Rehost complete',
      );
      setRehostUrls('');
    } catch (err) {
      toast.error(err);
    } finally {
      setRehosting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="AI settings"
        description="Provider registry and the batch jobs that keep entity media usable by the AI."
      />

      <div className="stack">
        <Card
          title="Providers"
          subtitle="Reported by /api/ai-provider."
          actions={<Button size="sm" onClick={providersQuery.reload}>Refresh</Button>}
        >
          {providersQuery.loading && <LoadingBlock />}
          {providersQuery.error && (
            <ErrorState error={providersQuery.error} onRetry={providersQuery.reload} />
          )}
          {!providersQuery.loading && !providersQuery.error && (
            <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0, overflowX: 'auto' }}>
              {JSON.stringify(providersQuery.data, null, 2)}
            </pre>
          )}
        </Card>

        <Card
          title="Photo analysis backfill"
          subtitle="Runs the vision model over photos that have never been analyzed."
          actions={
            <Button variant="primary" size="sm" loading={backfilling} onClick={runBackfill}>
              Run a batch
            </Button>
          }
        >
          <Notice tone="info">
            Each run processes one batch and reports how many photos are left. Run it repeatedly
            until <code>remaining</code> reaches zero.
          </Notice>
          {backfillResult && (
            <>
              <div style={{ height: 'var(--space-4)' }} />
              <div className="grid-auto">
                <Stat label="Processed this run" value={backfillResult.processed ?? 0} tone="success" />
                <Stat
                  label="Remaining"
                  value={backfillResult.remaining ?? 0}
                  tone={backfillResult.remaining ? 'warning' : 'success'}
                />
              </div>
            </>
          )}
        </Card>

        <Card
          title="Photo repair"
          subtitle="Finds and fixes broken image references."
          actions={
            <>
              <Button size="sm" onClick={repairQuery.reload}>Check status</Button>
              <Button size="sm" variant="primary" loading={repairing} onClick={runRepair}>
                Run repair
              </Button>
            </>
          }
        >
          {repairQuery.loading && <LoadingBlock />}
          {repairQuery.error && <ErrorState error={repairQuery.error} onRetry={repairQuery.reload} />}
          {!repairQuery.loading && !repairQuery.error && repairQuery.data && (
            <div className="grid-auto">
              {Object.entries(repairQuery.data)
                .filter(([, value]) => typeof value !== 'object')
                .map(([key, value]) => (
                  <Stat key={key} label={key.replace(/_/g, ' ')} value={String(value)} />
                ))}
            </div>
          )}
        </Card>

        <Card
          title="Rehost photos"
          subtitle="Copy external image URLs into GCR storage so they stop depending on someone else's server."
          actions={
            <Button size="sm" variant="primary" loading={rehosting} onClick={runRehost}>
              Rehost
            </Button>
          }
        >
          <div className="stack">
            <EntityPicker value={rehostSlug} onChange={setRehostSlug} label="Business" />
            <div>
              <label className="ui-field__label" htmlFor="rehost-urls">Image URLs</label>
              <textarea
                id="rehost-urls"
                className="ui-input ui-input--area mono"
                rows={6}
                value={rehostUrls}
                placeholder={'https://example.com/one.jpg\nhttps://example.com/two.jpg'}
                onChange={(e) => setRehostUrls(e.target.value)}
              />
              <p className="ui-field__help">One URL per line, or comma-separated.</p>
            </div>
            {rehostUrls.trim() && (
              <Badge tone="info">
                {rehostUrls.split(/[\n,]/).filter((u) => u.trim()).length} URLs
              </Badge>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
