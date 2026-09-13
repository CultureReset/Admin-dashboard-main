/**
 * Run log — every execution across every business.
 *
 * GET /api/admin/automations/runs/recent
 *
 * Filter by status or by business; open a row for its step-by-step log. A
 * run that quietly did nothing is the failure that actually happens, and
 * this is where it shows.
 */

import { useMemo, useState } from 'react';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { useAsync } from '../../hooks/useAsync.js';
import { PageHeader, Card, Button, LoadingBlock, ErrorState, EmptyState, Stat, SearchInput } from '../../ui/primitives.jsx';
import { RunRow } from './RunLog.jsx';
import './automations.css';

export default function Runs() {
  const [status, setStatus] = useState('');
  const [slug, setSlug] = useState('');
  const [applied, setApplied] = useState('');

  const query = useAsync(
    async () => api.get(endpoints.automations.runs(), { query: { status, slug: applied, limit: 200 } }),
    [status, applied],
    { initialData: null },
  );
  const runs = useMemo(() => query.data?.runs || [], [query.data]);
  const counts = query.data?.counts || {};

  return (
    <div>
      <PageHeader
        title="Run log"
        description="Every run, with what each step did. Dry runs from the builder are here too, marked."
        actions={
          <>
            {['', 'ok', 'failed', 'skipped'].map((s) => (
              <Button key={s || 'all'} variant={s === status ? 'primary' : 'ghost'} onClick={() => setStatus(s)}>{s || 'all'}</Button>
            ))}
            <Button onClick={() => query.reload()}>Refresh</Button>
          </>
        }
      />

      <div className="au__stats">
        <Stat label="Shown" value={runs.length} />
        <Stat label="OK" value={counts.ok || 0} tone="success" />
        <Stat label="Failed" value={counts.failed || 0} tone={counts.failed ? 'danger' : 'neutral'} />
        <Stat label="Skipped" value={counts.skipped || 0} hint="a condition stopped the run" />
      </div>

      <Card
        title="Recent runs"
        actions={
          <form onSubmit={(e) => { e.preventDefault(); setApplied(slug.trim()); }} style={{ display: 'flex', gap: 8 }}>
            <SearchInput value={slug} onChange={setSlug} placeholder="Filter by business slug…" />
            <Button type="submit" onClick={() => setApplied(slug.trim())}>Filter</Button>
          </form>
        }
      >
        {query.loading && <LoadingBlock label="Loading runs…" />}
        {query.error && <ErrorState error={query.error} onRetry={query.reload} context="run log" />}
        {!query.loading && !query.error && (
          runs.length
            ? <div className="au__steps">{runs.map((r) => <RunRow key={r.id} run={r} showAutomation />)}</div>
            : <EmptyState icon="🧾" title="No runs yet" description="Runs appear here as automations fire — by hand, on schedule, on an event, or from a URL." />
        )}
      </Card>
    </div>
  );
}
