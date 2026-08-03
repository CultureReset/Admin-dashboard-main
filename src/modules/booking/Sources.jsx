/**
 * Booking sources — what each business is actually attached to.
 *
 * There are no live API connections to Peek Pro, FareHarbor, Thoroughbred and
 * the rest, and there don't need to be. Their confirmation emails arrive at
 * gcr-<slug>@parse.gulfcoastradar.com, and routes/email-parser.js recognises
 * 24 platforms and logs every attempt to email_parser_log.
 *
 * So this screen answers "what does this business use?" from what has actually
 * arrived, rather than from a field somebody remembered to set. A business
 * shows Peek Pro because Peek Pro emails have landed, not because it was
 * ticked in a form.
 *
 * Three things worth acting on, in order:
 *   - businesses sending nothing at all — the BCC was never set up
 *   - emails that arrived but no extractor understood — a parser gap
 *   - what everyone else is on, for the aggregate picture
 *
 * GET /api/admin/platform/parser/sources
 * GET /api/admin/platform/parser/log
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { TabBar } from '../../ui/Tabs.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, formatDateTime, formatNumber } from '../../lib/fields.jsx';

const TABS = [
  { id: 'attached', label: 'Attached' },
  { id: 'unattached', label: 'Nothing arriving' },
  { id: 'unrecognised', label: 'Not understood' },
];

export default function Sources() {
  const toast = useToast();
  const [tab, setTab] = useState('attached');
  const [platform, setPlatform] = useState('');
  const [detailFor, setDetailFor] = useState(null);
  const [copied, setCopied] = useState(null);

  const sourcesQuery = useAsync(
    async () => api.get(endpoints.bookingPlatform.parserSources()),
    [],
    { initialData: null },
  );

  // Emails that arrived but no extractor understood — a parser gap, and the
  // most actionable thing on this screen after "nothing arriving at all".
  const unparsedQuery = useAsync(
    async () =>
      unwrapList(
        await api.get(endpoints.bookingPlatform.parserLog(), {
          query: { parsed: 'false', limit: 200 },
        }),
        ['logs'],
      ),
    [],
    { initialData: [] },
  );

  const sources = useMemo(
    () => (Array.isArray(sourcesQuery.data?.sources) ? sourcesQuery.data.sources : []),
    [sourcesQuery.data],
  );
  const unattached = useMemo(
    () => (Array.isArray(sourcesQuery.data?.unattached) ? sourcesQuery.data.unattached : []),
    [sourcesQuery.data],
  );
  const unparsed = unparsedQuery.data || [];

  /** Platform totals across every business — what the portfolio runs on. */
  const platformTotals = useMemo(() => {
    const totals = new Map();
    for (const source of sources) {
      for (const p of source.platforms || []) {
        if (!totals.has(p.platform)) {
          totals.set(p.platform, { platform: p.platform, label: p.label, businesses: 0, emails: 0 });
        }
        const t = totals.get(p.platform);
        t.businesses += 1;
        t.emails += p.count;
      }
    }
    return [...totals.values()].sort((a, b) => b.businesses - a.businesses);
  }, [sources]);

  const rows = useMemo(
    () => (platform ? sources.filter((s) => (s.platforms || []).some((p) => p.platform === platform)) : sources),
    [sources, platform],
  );

  const copy = async (value, key) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.warning('Your browser blocked clipboard access.');
    }
  };

  const refresh = () => {
    sourcesQuery.reload();
    unparsedQuery.reload();
  };

  const totalEmails = sources.reduce((n, s) => n + s.total, 0);
  const totalFailed = sources.reduce((n, s) => n + s.failed, 0);

  return (
    <>
      <PageHeader
        title="Booking sources"
        description="Which booking system each business actually uses, from the emails that have arrived."
        actions={<Button onClick={refresh} disabled={sourcesQuery.loading}>Refresh</Button>}
      />

      <Notice tone="info" title="Derived from real email traffic, not a form field">
        <p>
          There is no live API connection to Peek Pro, FareHarbor or the others — their
          confirmation emails arrive at{' '}
          <code className="mono">gcr-&lt;slug&gt;@parse.gulfcoastradar.com</code> and get parsed.
          A business appears under a platform because that platform&apos;s emails have landed,
          which is a stronger signal than anything typed into a field.
        </p>
        <p style={{ marginTop: 8 }}>
          Parsed bookings become date claims in <Link to="/booking/date-claims">the calendar</Link>,
          which is what availability is computed from.
        </p>
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      {sourcesQuery.error && <ErrorState error={sourcesQuery.error} onRetry={sourcesQuery.reload} />}
      {sourcesQuery.loading && <LoadingBlock />}

      {!sourcesQuery.loading && !sourcesQuery.error && (
        <>
          <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
            <Stat label="Businesses attached" value={sources.length} tone="success" />
            <Stat
              label="Nothing arriving"
              value={unattached.length}
              tone={unattached.length ? 'warning' : 'neutral'}
              hint={`of ${sourcesQuery.data?.active_businesses ?? 0} active`}
            />
            <Stat label="Platforms in use" value={platformTotals.length} tone="primary" />
            <Stat label="Emails scanned" value={formatNumber(totalEmails)} />
            <Stat
              label="Not understood"
              value={totalFailed}
              tone={totalFailed ? 'danger' : 'success'}
            />
          </div>

          <Card
            title="Platforms across the portfolio"
            subtitle="How many businesses send from each system."
          >
            {platformTotals.length === 0 ? (
              <p className="muted">No platform activity in the scanned window.</p>
            ) : (
              <div className="row-wrap" style={{ gap: 6 }}>
                {platformTotals.map((p) => (
                  <button
                    key={p.platform}
                    type="button"
                    className={`ui-multi__chip ${platform === p.platform ? 'is-active' : ''}`}
                    onClick={() => setPlatform(platform === p.platform ? '' : p.platform)}
                    title={`${p.emails} emails`}
                  >
                    {p.label} · {p.businesses}
                  </button>
                ))}
              </div>
            )}
          </Card>

          <div style={{ height: 'var(--space-5)' }} />

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <TabBar
              tabs={TABS.map((t) => ({
                ...t,
                badge:
                  t.id === 'attached'
                    ? rows.length
                    : t.id === 'unattached'
                      ? unattached.length
                      : unparsed.length,
              }))}
              activeId={tab}
              onChange={setTab}
            />
          </div>

          {tab === 'attached' && (
            <Card padded={false}>
              <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
                <DataTable
                  columns={[
                    {
                      key: 'entity_name',
                      header: 'Business',
                      value: (row) => row.entity_name || row.entity_slug,
                      render: (row) => (
                        <div>
                          <div className="ui-cell-primary">
                            {row.entity_name ? (
                              <Link to={`/directory/entity/${encodeURIComponent(row.entity_slug)}`}>
                                {row.entity_name}
                              </Link>
                            ) : (
                              <span className="mono">{row.entity_slug}</span>
                            )}
                          </div>
                          <div className="ui-cell-sub mono">{row.entity_slug}</div>
                        </div>
                      ),
                    },
                    {
                      key: 'platforms',
                      header: 'Attached to',
                      searchable: false,
                      value: (row) => (row.platforms || []).map((p) => p.label).join(' '),
                      render: (row) => (
                        <span className="row-wrap" style={{ gap: 4 }}>
                          {(row.platforms || []).map((p) => (
                            <Badge
                              key={p.platform}
                              tone={p.platform === 'unknown' ? 'warning' : 'info'}
                              title={`${p.count} emails`}
                            >
                              {p.label} · {p.count}
                            </Badge>
                          ))}
                        </span>
                      ),
                    },
                    columns.number('total', 'Emails'),
                    {
                      key: 'failed',
                      header: 'Unparsed',
                      align: 'right',
                      render: (row) =>
                        row.failed ? <Badge tone="danger">{row.failed}</Badge> : <span className="faint">0</span>,
                    },
                    {
                      key: 'last_seen',
                      header: 'Last received',
                      render: (row) => formatDateTime(row.last_seen) || <span className="faint">—</span>,
                    },
                    {
                      key: '__actions',
                      header: '',
                      align: 'right',
                      sortable: false,
                      searchable: false,
                      stopPropagation: true,
                      render: (row) => (
                        <Button size="sm" onClick={() => setDetailFor(row)}>Recent emails</Button>
                      ),
                    },
                  ]}
                  rows={rows}
                  rowKey="entity_slug"
                  searchPlaceholder="Search businesses or platforms…"
                  emptyTitle={platform ? 'No businesses on that platform' : 'Nothing attached yet'}
                  emptyDescription="No parsed emails in the scanned window."
                  initialSort={{ key: 'total', direction: 'desc' }}
                />
              </div>
            </Card>
          )}

          {tab === 'unattached' && (
            <Card
              padded={false}
              title="Active businesses the parser has never heard from"
              subtitle="Either they are not forwarding, or the BCC address was never set up."
            >
              <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
                {unattached.length === 0 ? (
                  <EmptyState
                    icon="✅"
                    title="Every active business is sending"
                    description="Nothing to chase."
                  />
                ) : (
                  <DataTable
                    columns={[
                      {
                        key: 'entity_name',
                        header: 'Business',
                        render: (row) => (
                          <Link to={`/directory/entity/${encodeURIComponent(row.entity_slug)}`}>
                            {row.entity_name || row.entity_slug}
                          </Link>
                        ),
                      },
                      columns.text('entity_type', 'Type'),
                      {
                        key: 'bcc_email',
                        header: 'BCC address to give them',
                        stopPropagation: true,
                        render: (row) => (
                          <span className="row" style={{ gap: 6 }}>
                            <span className="mono">{row.bcc_email}</span>
                            <Button
                              size="sm"
                              variant="link"
                              onClick={() => copy(row.bcc_email, row.entity_slug)}
                            >
                              {copied === row.entity_slug ? 'Copied' : 'Copy'}
                            </Button>
                          </span>
                        ),
                      },
                    ]}
                    rows={unattached}
                    rowKey="entity_slug"
                    searchPlaceholder="Search businesses…"
                  />
                )}
              </div>
            </Card>
          )}

          {tab === 'unrecognised' && (
            <Card
              padded={false}
              title="Emails that arrived but no extractor understood"
              subtitle="Each one is a booking that did not make it into the calendar."
            >
              <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
                {unparsedQuery.loading && <LoadingBlock />}
                {unparsedQuery.error && (
                  <ErrorState error={unparsedQuery.error} onRetry={unparsedQuery.reload} />
                )}
                {!unparsedQuery.loading && !unparsedQuery.error && unparsed.length === 0 && (
                  <EmptyState
                    icon="✅"
                    title="Everything is being parsed"
                    description="No unrecognised emails in the recent window."
                  />
                )}
                {!unparsedQuery.loading && unparsed.length > 0 && (
                  <DataTable
                    columns={[
                      columns.dateTime('created_at', 'Received'),
                      {
                        key: 'entity_name',
                        header: 'Business',
                        value: (row) => row.entity_name || row.entity_slug,
                        render: (row) => row.entity_name || <span className="mono">{row.entity_slug || '—'}</span>,
                      },
                      columns.text('from_email', 'From'),
                      columns.text('subject', 'Subject'),
                    ]}
                    rows={unparsed}
                    rowKey={(row, i) => row.id ?? i}
                    searchPlaceholder="Search subjects and senders…"
                    initialSort={{ key: 'created_at', direction: 'desc' }}
                  />
                )}
              </div>
            </Card>
          )}
        </>
      )}

      <Modal
        open={Boolean(detailFor)}
        onClose={() => setDetailFor(null)}
        size="lg"
        title={detailFor ? `Recent emails — ${detailFor.entity_name || detailFor.entity_slug}` : ''}
        description={detailFor?.bcc_email}
      >
        {detailFor && <RecentEmails slug={detailFor.entity_slug} />}
      </Modal>
    </>
  );
}

/** The last emails parsed for one business. */
function RecentEmails({ slug }) {
  const { data, loading, error, reload } = useAsync(
    async () =>
      unwrapList(
        await api.get(endpoints.bookingPlatform.parserLog(), { query: { slug, limit: 100 } }),
        ['logs'],
      ),
    [slug],
    { initialData: [] },
  );

  const logs = data || [];

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (logs.length === 0) {
    return <EmptyState icon="✉️" title="No emails" description="Nothing has arrived for this business." />;
  }

  return (
    <DataTable
      columns={[
        columns.dateTime('created_at', 'Received'),
        {
          key: 'platform',
          header: 'Platform',
          render: (row) => <Badge tone={row.parsed === false ? 'danger' : 'info'}>{row.platform}</Badge>,
        },
        columns.text('customer_name', 'Customer'),
        columns.date('event_date', 'For'),
        columns.number('party_size', 'Party'),
        columns.text('activity_name', 'Activity'),
      ]}
      rows={logs}
      rowKey={(row, i) => row.id ?? i}
      dense
      initialSort={{ key: 'created_at', direction: 'desc' }}
    />
  );
}
