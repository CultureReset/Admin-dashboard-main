/**
 * Openings — near-term dates that still have spots, and what to do about them.
 *
 * This is what the whole ingestion pipeline is for. Forwarded confirmation
 * emails and external iCal feeds keep the count honest without a single API
 * credential; capacity turns that count into "three seats left on Saturday";
 * and a seat left on Saturday is a thing you can still sell on Friday.
 *
 * Two ways to act on one, both from this page:
 *   Post a deal    writes to gcr_deals, which is what the public deals feed
 *                  and the Trip Swipe cards read
 *   Text guests    SMS the tourists who already saved or swiped right on that
 *                  business — people who said they were interested and are in
 *                  town right now
 *
 * A gap that already has a live deal is marked, so the same opening doesn't
 * get marketed twice.
 *
 * GET  /api/admin/platform/openings
 * GET/POST/PATCH /api/admin/platform/deals
 * POST /api/admin/sms-blast/preview  → { count }
 * POST /api/admin/sms-blast          → { sent, total }
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Modal, useConfirm } from '../../ui/Modal.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { TabBar } from '../../ui/Tabs.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { DEAL_TYPES } from '../../api/bookingResources.js';
import { columns, fields, formatDate } from '../../lib/fields.jsx';

const MAX_SMS_LENGTH = 160;

const WINDOWS = [
  { value: 1, label: 'Today' },
  { value: 2, label: 'Today + tomorrow' },
  { value: 3, label: 'Next 3 days' },
  { value: 7, label: 'Next 7 days' },
  { value: 14, label: 'Next 14 days' },
];

const TABS = [
  { id: 'openings', label: 'Openings' },
  { id: 'deals', label: 'Posted deals' },
];

function todayIso() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/** "TODAY" / "TOMORROW" / the date, matching how the deal cards read. */
function whenWord(date) {
  const today = todayIso();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (date === today) return 'TODAY';
  if (date === tomorrow) return 'TOMORROW';
  return formatDate(date);
}

/**
 * "07:00" → "7am". Slots arrive as HH:MM or HH:MM:SS; trimming the trailing
 * ":00" the way the API's own auto-headline does leaves a bare "7", which
 * reads as nothing at all in a deal headline.
 */
function clock(slot) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(slot || ''));
  if (!m) return '';
  const hour = Number(m[1]);
  const minutes = m[2];
  const suffix = hour >= 12 ? 'pm' : 'am';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return minutes === '00' ? `${twelve}${suffix}` : `${twelve}:${minutes}${suffix}`;
}

/** A headline in the same voice the auto-generated ones use. */
function suggestHeadline(row) {
  const spots = row.remaining_spots;
  const word = spots === 1 ? 'spot' : 'spots';
  const time = row.time_slot && row.time_slot !== '00:00' ? ` at ${clock(row.time_slot)}` : '';
  const sub = String(row.entity_subtype || '');
  if (/charter|fishing/.test(sub)) return `🎣 ${spots} walk-on ${word} open — ${whenWord(row.date)}${time}`;
  if (/rental/.test(sub)) return `🏠 Last-minute opening — ${whenWord(row.date)}${time}`;
  return `⚡ ${spots} ${word} just opened up — ${whenWord(row.date)}${time}`;
}

function suggestMessage(row) {
  const name = row.entity_name || row.entity_slug;
  const spots = row.remaining_spots;
  const word = spots === 1 ? 'spot' : 'spots';
  const base = `${name}: ${spots} ${word} left ${whenWord(row.date).toLowerCase()}.`;
  const tail = row.phone ? ` Call ${row.phone}` : row.booking_url ? ` Book: ${row.booking_url}` : '';
  return `${base}${tail}`.slice(0, MAX_SMS_LENGTH);
}

const dealSchema = {
  groups: [
    {
      title: 'The offer',
      fields: [
        fields.text('headline', 'Headline', { required: true, span: 'full' }),
        fields.select('deal_type', 'Type', DEAL_TYPES, { required: true }),
        fields.date('valid_date', 'Valid on', { required: true }),
        fields.money('deal_price', 'Deal price'),
        fields.money('original_price', 'Usual price'),
        fields.number('spots_remaining', 'Spots left', { min: 0, step: 1 }),
        fields.number('spots_total', 'Spots total', { min: 0, step: 1 }),
      ],
    },
    {
      title: 'How to claim it',
      fields: [
        fields.select('claim_type', 'Claim by', [
          { value: 'link', label: 'Booking link' },
          { value: 'phone', label: 'Phone call' },
        ]),
        fields.url('claim_url', 'Booking link'),
        fields.tel('claim_phone', 'Phone'),
      ],
    },
    {
      title: 'Where it shows',
      fields: [
        fields.bool('promoted_feed', 'Deals feed', { defaultValue: true }),
        fields.bool('swipe_card', 'Trip Swipe card', { defaultValue: true }),
        fields.bool('is_featured', 'Feature it'),
        fields.bool('is_today_only', 'Today only'),
      ],
    },
  ],
};

export default function Openings() {
  const toast = useToast();
  const [tab, setTab] = useState('openings');
  const [slug, setSlug] = useState(null);
  const [days, setDays] = useState(3);
  const [threshold, setThreshold] = useState(5);
  const [posting, setPosting] = useState(null);
  const [texting, setTexting] = useState(null);
  const [confirm, confirmElement] = useConfirm();

  const openingsQuery = useAsync(
    async () =>
      api.get(endpoints.bookingPlatform.openings(), {
        query: { slug: slug || undefined, days, threshold, limit: 500 },
      }),
    [slug, days, threshold],
    { initialData: null },
  );

  const dealsQuery = useAsync(
    async () =>
      unwrapList(
        await api.get(endpoints.bookingPlatform.deals(), {
          query: { slug: slug || undefined, active: 'true', from: todayIso(), limit: 300 },
        }),
        ['deals'],
      ),
    [slug],
    { initialData: [] },
  );

  const openings = useMemo(
    () => (Array.isArray(openingsQuery.data?.openings) ? openingsQuery.data.openings : []),
    [openingsQuery.data],
  );
  const deals = dealsQuery.data || [];

  const spots = openings.reduce((n, o) => n + (Number(o.remaining_spots) || 0), 0);

  const postDeal = async (values) => {
    await api.post(endpoints.bookingPlatform.deals(), {
      ...values,
      entity_slug: posting.entity_slug,
      entity_name: posting.entity_name || undefined,
      image_url: posting.image_url || undefined,
      price_unit: posting.price_unit || undefined,
      valid_start_time:
        posting.time_slot && posting.time_slot !== '00:00' ? posting.time_slot : undefined,
    });
    toast.success('Deal posted. It is live on the deals feed now.');
    setPosting(null);
    openingsQuery.reload();
    dealsQuery.reload();
  };

  const retire = async (deal) => {
    const ok = await confirm({
      title: 'Retire this deal',
      message: `Take "${deal.headline}" down? It stops showing on the deals feed and the swipe cards. The opening itself is unaffected.`,
      confirmLabel: 'Retire it',
    });
    if (!ok) return;
    try {
      await api.patch(endpoints.bookingPlatform.deal(deal.id), { is_active: false });
      toast.success('Deal retired.');
      dealsQuery.reload();
      openingsQuery.reload();
    } catch (err) {
      toast.error(err.message, 'Could not retire the deal');
    }
  };

  return (
    <>
      <PageHeader
        title="Openings"
        description="Dates that still have spots, and the two ways to fill them."
        actions={
          <Button
            onClick={() => {
              openingsQuery.reload();
              dealsQuery.reload();
            }}
            disabled={openingsQuery.loading}
          >
            Refresh
          </Button>
        }
      />

      <Notice tone="info" title="This is what the parser is for">
        <p>
          A forwarded confirmation says a date got booked;{' '}
          <Link to="/booking/inventory">capacity</Link> says how much is left. When that number
          is small and the date is close, it is worth selling — post a deal, or text the people
          who already saved that business and are in town.
        </p>
        <p style={{ marginTop: 8 }}>
          A business with no capacity on file never appears here, however many bookings it sends.
        </p>
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <Card>
        <div className="row-wrap" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
          <div style={{ minWidth: 210, flex: 1, maxWidth: 290 }}>
            <EntityPicker value={slug} onChange={setSlug} label={null} placeholder="All businesses…" />
          </div>
          <select
            className="ui-input ui-input--select"
            style={{ width: 'auto' }}
            value={days}
            aria-label="Window"
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {WINDOWS.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
          <select
            className="ui-input ui-input--select"
            style={{ width: 'auto' }}
            value={threshold}
            aria-label="Maximum spots left"
            onChange={(e) => setThreshold(Number(e.target.value))}
          >
            {[1, 2, 3, 5, 10, 25].map((n) => (
              <option key={n} value={n}>Up to {n} spot{n === 1 ? '' : 's'} left</option>
            ))}
          </select>
        </div>
      </Card>

      <div style={{ height: 'var(--space-4)' }} />

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="Openings" value={openings.length} tone={openings.length ? 'primary' : 'neutral'} />
        <Stat label="Spots to sell" value={spots} tone={spots ? 'success' : 'neutral'} />
        <Stat
          label="Not yet marketed"
          value={openingsQuery.data?.unmarketed ?? 0}
          tone={openingsQuery.data?.unmarketed ? 'warning' : 'success'}
        />
        <Stat label="Live deals" value={deals.length} />
      </div>

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <TabBar
          tabs={TABS.map((t) => ({
            ...t,
            badge: t.id === 'openings' ? openings.length : deals.length,
          }))}
          activeId={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'openings' && (
        <>
          {openingsQuery.loading && <LoadingBlock />}
          {openingsQuery.error && (
            <ErrorState error={openingsQuery.error} onRetry={openingsQuery.reload} />
          )}
          {!openingsQuery.loading && !openingsQuery.error && (
            <Card padded={false}>
              <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
                {openings.length === 0 ? (
                  <EmptyState
                    icon="📭"
                    title="Nothing open in this window"
                    description="Either everything is booked, or the businesses sending bookings have no capacity on file."
                    action={<Link to="/booking/inventory">Check capacity</Link>}
                  />
                ) : (
                  <DataTable
                    columns={[
                      {
                        key: 'date',
                        header: 'When',
                        render: (row) => (
                          <div>
                            <div className="ui-cell-primary">{whenWord(row.date)}</div>
                            <div className="ui-cell-sub">
                              {row.date}
                              {row.time_slot && row.time_slot !== '00:00' ? ` · ${clock(row.time_slot)}` : ''}
                            </div>
                          </div>
                        ),
                      },
                      {
                        key: 'entity_name',
                        header: 'Business',
                        value: (row) => row.entity_name || row.entity_slug,
                        render: (row) => (
                          <div>
                            <div>
                              <Link to={`/directory/entity/${encodeURIComponent(row.entity_slug)}`}>
                                {row.entity_name || row.entity_slug}
                              </Link>
                            </div>
                            {row.entity_subtype && (
                              <div className="ui-cell-sub">{row.entity_subtype}</div>
                            )}
                          </div>
                        ),
                      },
                      {
                        key: 'remaining_spots',
                        header: 'Left',
                        align: 'right',
                        render: (row) => (
                          <Badge tone={row.remaining_spots <= 2 ? 'danger' : 'warning'}>
                            {row.remaining_spots}
                          </Badge>
                        ),
                      },
                      {
                        key: 'total_capacity',
                        header: 'of',
                        align: 'right',
                        render: (row) => row.total_capacity ?? <span className="faint">—</span>,
                      },
                      {
                        key: 'source_platform',
                        header: 'Known from',
                        render: (row) =>
                          row.source_platform ? (
                            <span className="mono">{row.source_platform}</span>
                          ) : (
                            <span className="faint">manual</span>
                          ),
                      },
                      {
                        key: 'deal_posted',
                        header: 'Marketed',
                        searchable: false,
                        render: (row) =>
                          row.deal_posted ? (
                            <Badge tone="success" title={row.deal?.headline || ''}>Deal live</Badge>
                          ) : (
                            <Badge tone="neutral">Not yet</Badge>
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
                          <span className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                            <Button
                              size="sm"
                              variant={row.deal_posted ? 'default' : 'primary'}
                              onClick={() => setPosting(row)}
                            >
                              {row.deal_posted ? 'Post another' : 'Post deal'}
                            </Button>
                            <Button size="sm" onClick={() => setTexting(row)}>Text guests</Button>
                          </span>
                        ),
                      },
                    ]}
                    rows={openings}
                    rowKey={(row, i) => row.id ?? i}
                    searchPlaceholder="Search businesses…"
                    initialSort={{ key: 'date', direction: 'asc' }}
                  />
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {tab === 'deals' && (
        <>
          {dealsQuery.loading && <LoadingBlock />}
          {dealsQuery.error && <ErrorState error={dealsQuery.error} onRetry={dealsQuery.reload} />}
          {!dealsQuery.loading && !dealsQuery.error && (
            <Card
              padded={false}
              title="Live deals"
              subtitle="Posted by hand here, or auto-posted by the parser when a date dropped to a few spots."
            >
              <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
                <DataTable
                  columns={[
                    {
                      key: 'headline',
                      header: 'Deal',
                      render: (row) => (
                        <div>
                          <div className="ui-cell-primary">{row.headline}</div>
                          <div className="ui-cell-sub">{row.entity_name || row.entity_slug}</div>
                        </div>
                      ),
                    },
                    columns.date('valid_date', 'Valid'),
                    {
                      key: 'spots_remaining',
                      header: 'Spots',
                      align: 'right',
                      render: (row) =>
                        row.spots_remaining ?? <span className="faint">—</span>,
                    },
                    columns.money('deal_price', 'Price'),
                    {
                      key: 'source',
                      header: 'Posted by',
                      render: (row) => (
                        <Badge tone={row.source === 'admin' ? 'info' : 'neutral'}>
                          {row.source === 'email_parser'
                            ? 'parser (auto)'
                            : row.source === 'availability_sync'
                              ? 'availability (auto)'
                              : row.source || 'manual'}
                        </Badge>
                      ),
                    },
                    {
                      key: 'promoted_sms',
                      header: 'Channels',
                      sortable: false,
                      searchable: false,
                      render: (row) => (
                        <span className="row-wrap" style={{ gap: 4 }}>
                          {row.promoted_feed && <Badge tone="info">feed</Badge>}
                          {row.swipe_card && <Badge tone="info">swipe</Badge>}
                          {row.promoted_sms && <Badge tone="warning">sms</Badge>}
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
                        <Button size="sm" variant="danger" onClick={() => retire(row)}>Retire</Button>
                      ),
                    },
                  ]}
                  rows={deals}
                  rowKey="id"
                  searchPlaceholder="Search deals…"
                  emptyTitle="No live deals"
                  emptyDescription="Nothing is being promoted right now."
                  initialSort={{ key: 'valid_date', direction: 'asc' }}
                />
              </div>
            </Card>
          )}
        </>
      )}

      <Modal
        open={Boolean(posting)}
        onClose={() => setPosting(null)}
        size="lg"
        title="Post a deal"
        description={
          posting
            ? `${posting.entity_name || posting.entity_slug} · ${posting.date}${
                posting.time_slot && posting.time_slot !== '00:00' ? ` · ${clock(posting.time_slot)}` : ''
              }`
            : ''
        }
      >
        {posting && (
          <SchemaForm
            schema={dealSchema}
            initialValues={{
              headline: suggestHeadline(posting),
              deal_type: /charter|fishing/.test(String(posting.entity_subtype || ''))
                ? 'charter_opening'
                : /rental/.test(String(posting.entity_subtype || ''))
                  ? 'rental_gap'
                  : 'last_minute',
              valid_date: posting.date,
              deal_price: posting.price_from ?? '',
              spots_remaining: posting.remaining_spots ?? '',
              spots_total: posting.total_capacity ?? '',
              claim_type: posting.booking_url ? 'link' : 'phone',
              claim_url: posting.booking_url || '',
              claim_phone: posting.phone || '',
              promoted_feed: true,
              swipe_card: true,
              is_featured: posting.remaining_spots === 1,
              is_today_only: posting.date === todayIso(),
            }}
            submitLabel="Post deal"
            onSubmit={postDeal}
            onCancel={() => setPosting(null)}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(texting)}
        onClose={() => setTexting(null)}
        size="md"
        title="Text interested guests"
        description={
          texting ? `${texting.entity_name || texting.entity_slug} · ${texting.date}` : ''
        }
      >
        {texting && <OutreachForm opening={texting} onDone={() => setTexting(null)} />}
      </Modal>

      {confirmElement}
    </>
  );
}

/**
 * Text the tourists who already showed interest in this business.
 *
 * The audience is deliberately narrow: opted-in, in town today, and they
 * either saved this business or swiped right on it. Counting before sending is
 * enforced — the send button stays disabled until the audience is known,
 * because this texts real people and cannot be undone.
 */
function OutreachForm({ opening, onDone }) {
  const toast = useToast();
  const [message, setMessage] = useState(() => suggestMessage(opening));
  const [audience, setAudience] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirm, confirmElement] = useConfirm();

  // `saved` and `swiped_right` intersect inside the API, so sending both would
  // narrow to people who did BOTH. One signal at a time is the honest filter.
  const [signal, setSignal] = useState('saved');

  const body = () => ({
    message,
    in_town_only: true,
    ...(signal === 'saved'
      ? { saved: [opening.entity_slug] }
      : { swiped_right: [opening.entity_slug] }),
  });

  const preview = async () => {
    setPreviewing(true);
    setAudience(null);
    try {
      const response = await api.post(endpoints.sms.blastPreview(), body());
      setAudience(response?.count ?? 0);
      if (response?.error) toast.warning(response.error);
    } catch (err) {
      toast.error(err);
    } finally {
      setPreviewing(false);
    }
  };

  const send = async () => {
    const ok = await confirm({
      title: 'Send this text?',
      message: `This texts ${audience} ${audience === 1 ? 'person' : 'people'} immediately and cannot be undone.`,
      confirmLabel: `Send to ${audience}`,
      tone: 'primary',
    });
    if (!ok) return;
    setSending(true);
    try {
      const response = await api.post(endpoints.sms.blast(), body());
      toast.success(`Sent ${response?.sent ?? 0} of ${response?.total ?? audience}.`, 'Texts sent');
      onDone();
    } catch (err) {
      toast.error(err);
    } finally {
      setSending(false);
    }
  };

  const over = message.length > MAX_SMS_LENGTH;

  return (
    <>
      <div className="ui-field">
        <label className="ui-field__label" htmlFor="outreach-signal">Who to text</label>
        <select
          id="outreach-signal"
          className="ui-input ui-input--select"
          value={signal}
          onChange={(e) => {
            setSignal(e.target.value);
            setAudience(null);
          }}
        >
          <option value="saved">Guests who saved this business</option>
          <option value="swiped_right">Guests who swiped right on it</option>
        </select>
        <p className="ui-field__help">
          Opted in to SMS and in town today. Both lists are further narrowed to people whose
          visit covers today.
        </p>
      </div>

      <div className="ui-field">
        <label className="ui-field__label" htmlFor="outreach-message">Message</label>
        <textarea
          id="outreach-message"
          className="ui-input"
          rows={3}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setAudience(null);
          }}
        />
        <p className="ui-field__help">
          <span className={over ? 'ui-field__error' : ''}>
            {message.length} / {MAX_SMS_LENGTH}
          </span>
          {over && ' — over one segment, this will send as multiple messages.'}
        </p>
      </div>

      {audience != null && (
        <Notice tone={audience ? 'info' : 'warning'} title={`${audience} recipients`}>
          {audience === 0
            ? 'Nobody matches. Nothing will be sent.'
            : 'Counted, nothing sent yet. Sending is immediate and cannot be undone.'}
        </Notice>
      )}

      <div className="row" style={{ gap: 8, marginTop: 'var(--space-4)', justifyContent: 'flex-end' }}>
        <Button onClick={onDone}>Cancel</Button>
        <Button loading={previewing} disabled={!message.trim()} onClick={preview}>
          Count recipients
        </Button>
        <Button
          variant="primary"
          loading={sending}
          disabled={audience == null || audience === 0}
          onClick={send}
        >
          {audience == null ? 'Count first' : `Send to ${audience}`}
        </Button>
      </div>

      {confirmElement}
    </>
  );
}
