/**
 * AI feedback — what the concierge is being asked and how it is doing.
 *
 * The API has no dedicated feedback route, so this composes the signals it
 * does expose: the Trip Swipe analytics payload and the RAG index status.
 * That is stated plainly rather than implying a feedback log exists.
 */

import { Link } from 'react-router-dom';
import { Button, Card, Notice, PageHeader } from '../../ui/primitives.jsx';
import { PayloadCard } from '../engagement/Analytics.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';

export default function AiFeedback() {
  const analyticsQuery = useAsync(
    async () => api.get(endpoints.analytics.tripswipe(), { query: { period: 'week' } }),
    [],
    { initialData: null },
  );

  const ragQuery = useAsync(
    async () => api.get(endpoints.ai.ragStatus()),
    [],
    { initialData: null },
  );

  return (
    <>
      <PageHeader
        title="AI feedback"
        description="How well the concierge is answering, from the signals the API exposes."
        actions={
          <Button
            onClick={() => {
              analyticsQuery.reload();
              ragQuery.reload();
            }}
          >
            Refresh
          </Button>
        }
      />

      <Notice tone="info" title="No dedicated feedback log">
        <code>gcr-api-clean</code> does not store per-answer ratings, so this screen shows the
        related signals it does have: Trip Swipe engagement and how much content is indexed for
        retrieval. To try the concierge yourself, use{' '}
        <Link to="/tripswipe/concierge-test">Concierge Test</Link>.
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <div className="stack">
        <PayloadCard
          title="Engagement (last week)"
          subtitle="From /api/admin/tripswipe-analytics."
          query={analyticsQuery}
        />

        <PayloadCard
          title="Retrieval index"
          subtitle="How much content the concierge can draw on. From /api/admin/rag-status."
          query={ragQuery}
        />

        <Card title="Improving answers">
          <p className="muted">
            The concierge answers from indexed entity content. When answers are thin for a business,
            fill in its description and content on the{' '}
            <Link to="/directory/entity">Entity Editor</Link>, then reindex it from{' '}
            <Link to="/ai/rag-index">AI Index / RAG</Link>. Which model answers is set in{' '}
            <Link to="/content/ai-config">AI Config</Link>.
          </p>
        </Card>
      </div>
    </>
  );
}
