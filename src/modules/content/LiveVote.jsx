/**
 * Live song voting for one business.
 *
 * The room votes on songs from the business's songs list; this screen sets the
 * rules and shows tonight's ranked queue. The fields below are data: add a
 * setting by adding one descriptor here and one entry in the app's manifest.
 *
 * GET    /api/apps/live-vote/:slug/settings
 * PATCH  /api/apps/live-vote/:slug/settings
 * GET    /api/apps/live-vote/:slug/summary
 * DELETE /api/apps/live-vote/:slug/tonight
 */

import { useState } from 'react';
import { Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Stat } from '../../ui/primitives.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { EntityPicker } from '../../components/EntityPicker.jsx';

const SETTINGS_SCHEMA = [
  { name: 'voting_open', label: 'Voting is open', type: 'boolean', help: 'Turn off to freeze the board.' },
  { name: 'votes_per_person', label: 'Free votes per person per night', type: 'number', help: '1 to 50.' },
  { name: 'max_per_song', label: 'Most votes one person can put on one song', type: 'number', help: '1 to 10.' },
];

export default function LiveVote() {
  const toast = useToast();
  const [slug, setSlug] = useState(null);

  const settings = useAsync(async () => (slug ? api.get(endpoints.liveVote.settings(slug)) : null), [slug], {
    initialData: null,
  });
  const summary = useAsync(async () => (slug ? api.get(endpoints.liveVote.summary(slug)) : null), [slug], {
    initialData: null,
  });

  const save = async (values) => {
    try {
      await api.patch(endpoints.liveVote.settings(slug), values);
      toast.success('Saved.');
      await settings.reload();
    } catch (err) {
      toast.error(err);
    }
  };

  const reset = async () => {
    if (!window.confirm('Clear every vote cast tonight? This cannot be undone.')) return;
    try {
      await api.del(endpoints.liveVote.tonight(slug));
      toast.success('Tonight’s votes cleared.');
      await summary.reload();
    } catch (err) {
      toast.error(err);
    }
  };

  const queue = summary.data?.queue || [];

  return (
    <>
      <PageHeader
        title="Live voting"
        description="The room votes on what plays next. Pick a business to set the rules and watch the queue."
        actions={
          <Button onClick={summary.reload} disabled={!slug || summary.loading}>
            Refresh
          </Button>
        }
      />

      <Card title="Business">
        <EntityPicker value={slug} onChange={setSlug} label={null} placeholder="Pick a business…" />
      </Card>

      {slug && (
        <>
          <Card title="Rules">
            {settings.error && <ErrorState error={settings.error} onRetry={settings.reload} />}
            {settings.loading && <LoadingBlock />}
            {settings.data && (
              <SchemaForm key={slug} schema={SETTINGS_SCHEMA} initialValues={settings.data} onSubmit={save} />
            )}
          </Card>

          <Card
            title={`Tonight${summary.data?.night ? ` · ${summary.data.night}` : ''}`}
            actions={
              <Button onClick={reset} disabled={!queue.length}>
                Start the night over
              </Button>
            }
          >
            {summary.error && <ErrorState error={summary.error} onRetry={summary.reload} />}
            {summary.loading && <LoadingBlock />}
            {summary.data && (
              <>
                <div className="row" style={{ gap: 16, marginBottom: 12 }}>
                  <Stat label="Votes" value={summary.data.total_votes} />
                  <Stat label="Voters" value={summary.data.voters} />
                </div>
                {queue.length === 0 ? (
                  <EmptyState title="No votes yet tonight" />
                ) : (
                  <ol>
                    {queue.map((s) => (
                      <li key={s.id}>
                        {s.title}
                        {s.artist ? ` — ${s.artist}` : ''} · {s.votes}
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </Card>
        </>
      )}
    </>
  );
}
