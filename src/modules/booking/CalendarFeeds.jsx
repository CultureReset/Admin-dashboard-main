/**
 * External calendar feeds — the second way a date gets claimed.
 *
 * The email parser reads confirmations as they arrive. iCal works the other
 * way round: a business pastes the .ics export URL from Airbnb, VRBO, Google
 * or their own system, and a cron polls it hourly. Every date the feed marks
 * busy gets blocked here too, so a stay booked on Airbnb stops showing as
 * available on GCR.
 *
 * Between them the two paths cover the whole picture without a single API
 * credential: emails give you WHO booked and WHAT, feeds give you WHICH DATES
 * are gone. A business can run both.
 *
 * A feed tied to a resource claims just that unit — one condo in a building,
 * one boat in a fleet. A feed with no resource blocks the whole business for
 * those dates, so tie it to a unit whenever there is more than one.
 *
 * GET/POST   /api/admin/platform/calendars
 * PATCH/DEL  /api/admin/platform/calendars/:id
 * POST       /api/admin/platform/calendars/:id/sync
 *
 * The hourly cron is GET /api/email-parser/ical-import/run on the API side.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, ErrorState, LoadingBlock, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Modal, useConfirm } from '../../ui/Modal.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { ICAL_PROVIDERS } from '../../api/bookingResources.js';
import { fields, formatDateTime } from '../../lib/fields.jsx';

/** A feed's health is written back as free text by the sync job. */
function syncTone(row) {
  if (!row.last_synced_at) return { tone: 'neutral', label: 'Never synced' };
  if ((row.last_sync_status || '').startsWith('error')) return { tone: 'danger', label: 'Failing' };
  return { tone: 'success', label: 'OK' };
}

const feedSchema = {
  groups: [
    {
      title: 'The feed',
      fields: [
        fields.url('ical_url', 'iCal (.ics) URL', {
          required: true,
          span: 'full',
          placeholder: 'https://www.airbnb.com/calendar/ical/…',
          help: 'The export URL from the other system. Anyone with this URL can read the busy dates, so treat it as a secret.',
          validate: (value) =>
            value && !/^https?:\/\//i.test(value) ? 'Must start with http:// or https://' : null,
        }),
        fields.text('source_label', 'Label', {
          placeholder: 'Airbnb — Unit 4',
          help: 'What this feed is, in words. Shown on the blocked dates it creates.',
        }),
        fields.select('provider', 'Provider', ICAL_PROVIDERS),
        fields.text('resource_id', 'Applies to one unit', {
          span: 'full',
          help: 'An offering id, if this feed covers a single condo or boat. Leave blank and it blocks the whole business on those dates.',
        }),
      ],
    },
  ],
};

export default function CalendarFeeds() {
  const toast = useToast();
  const [slug, setSlug] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(null);
  const [confirm, confirmElement] = useConfirm();

  const query = useAsync(
    async () =>
      api.get(endpoints.bookingPlatform.icalFeeds(), {
        query: { slug: slug || undefined, limit: 500 },
      }),
    [slug],
    { initialData: null },
  );

  const feeds = useMemo(
    () => (Array.isArray(query.data?.calendars) ? query.data.calendars : []),
    [query.data],
  );

  const create = async (values) => {
    if (!slug) {
      // Without a business the row has nothing to attach to, and the API
      // rejects it — say so here rather than showing a 400.
      throw new Error('Pick a business above before adding a feed.');
    }
    await api.post(endpoints.bookingPlatform.icalFeeds(), {
      ...values,
      entity_slug: slug,
      resource_id: values.resource_id || undefined,
    });
    toast.success('Feed added. Run a sync to pull its dates in.');
    setCreating(false);
    query.reload();
  };

  const update = async (values) => {
    await api.patch(endpoints.bookingPlatform.icalFeed(editing.id), {
      ...values,
      resource_id: values.resource_id || null,
    });
    toast.success('Feed updated.');
    setEditing(null);
    query.reload();
  };

  const syncNow = async (row) => {
    setSyncing(row.id);
    try {
      const result = await api.post(endpoints.bookingPlatform.icalFeedSync(row.id), {});
      const status = result?.calendar?.last_sync_status || '';
      if (status.startsWith('error')) toast.warning(status, 'Sync finished with an error');
      else toast.success(status || 'Synced.');
      query.reload();
    } catch (err) {
      toast.error(err.message, 'Could not sync');
    } finally {
      setSyncing(null);
    }
  };

  const remove = async (row) => {
    const ok = await confirm({
      title: 'Remove calendar feed',
      message: `Remove "${row.source_label || row.ical_url}"? The dates it claimed are freed up, so anything booked through that system stops being blocked here.`,
      confirmLabel: 'Remove feed',
    });
    if (!ok) return;
    try {
      await api.del(endpoints.bookingPlatform.icalFeed(row.id));
      toast.success('Feed removed and its dates freed.');
      query.reload();
    } catch (err) {
      toast.error(err.message, 'Could not remove');
    }
  };

  return (
    <>
      <PageHeader
        title="Calendar feeds"
        description="External iCal links — the second way dates get claimed, alongside the email parser."
        actions={
          <>
            <Button onClick={query.reload} disabled={query.loading}>Refresh</Button>
            <Button variant="primary" onClick={() => setCreating(true)}>Add feed</Button>
          </>
        }
      />

      <Notice tone="info" title="Two ways in, one calendar">
        <p>
          <Link to="/booking/sources">Forwarded confirmation emails</Link> tell you who booked
          and what. iCal feeds tell you which dates are gone. Both write into the same{' '}
          <Link to="/booking/calendar">booking calendar</Link>, so a date taken anywhere is taken
          everywhere.
        </p>
        <p style={{ marginTop: 8 }}>
          Feeds are polled hourly. &ldquo;Sync now&rdquo; pulls one immediately.
        </p>
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <Card>
        <div className="row-wrap" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
          <div style={{ minWidth: 210, flex: 1, maxWidth: 290 }}>
            <EntityPicker value={slug} onChange={setSlug} label={null} placeholder="All businesses…" />
          </div>
          <span className="muted">
            {slug ? 'Adding a feed attaches it to this business.' : 'Pick a business to add a feed.'}
          </span>
        </div>
      </Card>

      <div style={{ height: 'var(--space-4)' }} />

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="Feeds" value={feeds.length} />
        <Stat
          label="Failing"
          value={query.data?.failing ?? 0}
          tone={query.data?.failing ? 'danger' : 'success'}
        />
        <Stat
          label="Never synced"
          value={query.data?.never_synced ?? 0}
          tone={query.data?.never_synced ? 'warning' : 'neutral'}
        />
      </div>

      {query.loading && <LoadingBlock />}
      {query.error && <ErrorState error={query.error} onRetry={query.reload} />}

      {!query.loading && !query.error && (
        <Card padded={false}>
          <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
            <DataTable
              columns={[
                {
                  key: 'source_label',
                  header: 'Feed',
                  render: (row) => (
                    <div>
                      <div className="ui-cell-primary">{row.source_label || 'External calendar'}</div>
                      {/* The URL is a bearer secret — show enough to identify it, never the whole thing. */}
                      <div className="ui-cell-sub mono" title="URL truncated deliberately">
                        {String(row.ical_url || '').slice(0, 48)}…
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'entity_name',
                  header: 'Business',
                  value: (row) => row.entity_name || row.entity_slug,
                  render: (row) => (
                    <Link to={`/directory/entity/${encodeURIComponent(row.entity_slug)}`}>
                      {row.entity_name || row.entity_slug}
                    </Link>
                  ),
                },
                {
                  key: 'provider',
                  header: 'Provider',
                  render: (row) =>
                    row.provider ? <Badge tone="info">{row.provider}</Badge> : <span className="faint">—</span>,
                },
                {
                  key: 'resource_id',
                  header: 'Scope',
                  searchable: false,
                  render: (row) =>
                    row.resource_id ? (
                      <Badge tone="neutral">One unit</Badge>
                    ) : (
                      <Badge tone="warning" title="Blocks the whole business on those dates">
                        Whole business
                      </Badge>
                    ),
                },
                {
                  key: 'last_sync_status',
                  header: 'Health',
                  value: (row) => syncTone(row).label,
                  render: (row) => {
                    const { tone, label } = syncTone(row);
                    return <Badge tone={tone} title={row.last_sync_status || ''}>{label}</Badge>;
                  },
                },
                {
                  key: 'last_synced_at',
                  header: 'Last sync',
                  render: (row) => formatDateTime(row.last_synced_at) || <span className="faint">never</span>,
                },
                {
                  key: '__actions',
                  header: '',
                  align: 'right',
                  sortable: false,
                  searchable: false,
                  stopPropagation: true,
                  render: (row) => (
                    <span className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <Button size="sm" loading={syncing === row.id} onClick={() => syncNow(row)}>
                        Sync now
                      </Button>
                      <Button size="sm" onClick={() => setEditing(row)}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => remove(row)}>Remove</Button>
                    </span>
                  ),
                },
              ]}
              rows={feeds}
              rowKey="id"
              searchPlaceholder="Search feeds and businesses…"
              emptyTitle="No calendar feeds"
              emptyDescription={
                slug
                  ? 'This business has no external calendar connected.'
                  : 'No business has connected an external calendar yet.'
              }
            />
          </div>
        </Card>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        size="md"
        title="Add a calendar feed"
        description={slug ? `Attaching to ${slug}` : 'Pick a business first — a feed must belong to one.'}
      >
        <SchemaForm
          schema={feedSchema}
          onSubmit={create}
          onCancel={() => setCreating(false)}
          submitLabel="Add feed"
        />
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        size="md"
        title="Edit calendar feed"
        description={editing?.entity_slug}
      >
        {editing && (
          <SchemaForm
            schema={feedSchema}
            initialValues={{
              ical_url: editing.ical_url || '',
              source_label: editing.source_label || '',
              provider: editing.provider || '',
              resource_id: editing.resource_id || '',
            }}
            onSubmit={update}
            onCancel={() => setEditing(null)}
            submitLabel="Save feed"
          />
        )}
      </Modal>

      {confirmElement}
    </>
  );
}
