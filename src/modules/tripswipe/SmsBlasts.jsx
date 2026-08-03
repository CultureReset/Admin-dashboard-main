/**
 * SMS blasts.
 *
 * POST /api/admin/sms-blast/preview  → { count }   audience size, sends nothing
 * POST /api/admin/sms-blast          → { sent, total, errors }
 * GET  /api/admin/sms-blasts         → history
 *
 * Previewing before sending is enforced in the UI: the send button stays
 * disabled until the audience has been counted, because this action texts real
 * people and cannot be undone.
 *
 * The filters below are exactly the keys routes/admin.js destructures. That
 * matters more than it looks: the route ignores unknown keys without a word,
 * so a filter named something the API doesn't read doesn't narrow the
 * audience — it quietly texts everyone who opted in.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, ErrorState, LoadingBlock, Notice, PageHeader } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useConfirm } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns } from '../../lib/fields.jsx';

const MAX_SMS_LENGTH = 160;

export default function SmsBlasts() {
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({
    in_town_only: true,
    tags: '',
    min_score: '',
    match_type: 'any',
    category: '',
    interested_in: '',
    interest_signal: 'saved',
  });
  const [audience, setAudience] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirm, confirmElement] = useConfirm();

  const historyQuery = useAsync(
    async () => unwrapList(await api.get(endpoints.sms.blasts()), ['blasts']),
    [],
    { initialData: [] },
  );

  /**
   * Exactly the shape /api/admin/sms-blast destructures. It ignores anything
   * else silently, so a filter named wrong doesn't narrow the audience — it
   * texts everybody. Every key here is one the API actually reads.
   */
  const body = () => {
    const out = { message, in_town_only: filters.in_town_only };

    const tags = filters.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length) {
      out.tags = tags;
      out.match_type = filters.match_type;
      if (filters.min_score !== '') out.min_score = Number(filters.min_score);
    }
    if (filters.category) out.category = filters.category;
    if (filters.interested_in) {
      // The API intersects `saved` and `swiped_right`, so sending both would
      // mean "did both" rather than "did either" — one signal at a time.
      out[filters.interest_signal === 'saved' ? 'saved' : 'swiped_right'] = [filters.interested_in];
    }
    return out;
  };

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
      title: 'Send this blast?',
      message: `This texts ${audience} people immediately and cannot be undone.`,
      confirmLabel: `Send to ${audience}`,
      tone: 'primary',
    });
    if (!ok) return;

    setSending(true);
    try {
      const response = await api.post(endpoints.sms.blast(), body());
      toast.success(
        `Sent ${response?.sent ?? 0} of ${response?.total ?? audience} messages.`,
        'Blast sent',
      );
      if (response?.errors?.length) {
        toast.warning(`${response.errors.length} messages failed.`);
      }
      setMessage('');
      setAudience(null);
      await historyQuery.reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setSending(false);
    }
  };

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    // Any filter change invalidates the counted audience.
    setAudience(null);
  };

  const segments = Math.max(1, Math.ceil(message.length / MAX_SMS_LENGTH));

  return (
    <>
      <PageHeader
        title="SMS blasts"
        description="Text a filtered group of Trip Swipe users."
        actions={<Button onClick={historyQuery.reload}>Refresh history</Button>}
      />

      <div className="stack">
        <Card title="Compose">
          <div className="stack">
            <div>
              <label className="ui-field__label" htmlFor="blast-message">Message</label>
              <textarea
                id="blast-message"
                className="ui-input ui-input--area"
                rows={5}
                value={message}
                placeholder="Keep it short — one segment is 160 characters."
                onChange={(e) => {
                  setMessage(e.target.value);
                  setAudience(null);
                }}
              />
              <p className="ui-field__help">
                {message.length} characters ·{' '}
                {segments} segment{segments === 1 ? '' : 's'}
                {segments > 1 && ' — longer messages cost more to send'}
              </p>
            </div>

            <div className="ui-form__grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              <div className="ui-field">
                <label className="ui-field__label" htmlFor="blast-intown">Who</label>
                <select
                  id="blast-intown"
                  className="ui-input ui-input--select"
                  value={filters.in_town_only ? 'in_town' : 'everyone'}
                  onChange={(e) => setFilter('in_town_only', e.target.value === 'in_town')}
                >
                  <option value="in_town">In town today</option>
                  <option value="everyone">Everyone opted in</option>
                </select>
                <p className="ui-field__help">Always limited to guests who opted in and have a phone.</p>
              </div>
              <div className="ui-field">
                <label className="ui-field__label" htmlFor="blast-tags">Interest tags</label>
                <input
                  id="blast-tags"
                  className="ui-input"
                  value={filters.tags}
                  placeholder="seafood, fishing"
                  onChange={(e) => setFilter('tags', e.target.value)}
                />
                <p className="ui-field__help">Comma separated. Blank means any interest.</p>
              </div>
              <div className="ui-field">
                <label className="ui-field__label" htmlFor="blast-match">Tag match</label>
                <select
                  id="blast-match"
                  className="ui-input ui-input--select"
                  value={filters.match_type}
                  disabled={!filters.tags.trim()}
                  onChange={(e) => setFilter('match_type', e.target.value)}
                >
                  <option value="any">Any of them</option>
                  <option value="all">All of them</option>
                </select>
              </div>
              <div className="ui-field">
                <label className="ui-field__label" htmlFor="blast-score">Minimum interest score</label>
                <input
                  id="blast-score"
                  className="ui-input"
                  type="number"
                  min="0"
                  value={filters.min_score}
                  placeholder="0"
                  disabled={!filters.tags.trim()}
                  onChange={(e) => setFilter('min_score', e.target.value)}
                />
              </div>
              <div className="ui-field">
                <label className="ui-field__label" htmlFor="blast-category">Category engaged with</label>
                <input
                  id="blast-category"
                  className="ui-input"
                  value={filters.category}
                  placeholder="restaurant, activity…"
                  onChange={(e) => setFilter('category', e.target.value)}
                />
              </div>
              <div className="ui-field">
                <label className="ui-field__label" htmlFor="blast-interest">Interested in one business</label>
                <div className="row" style={{ gap: 6 }}>
                  <select
                    className="ui-input ui-input--select"
                    style={{ width: 'auto' }}
                    value={filters.interest_signal}
                    aria-label="Interest signal"
                    onChange={(e) => setFilter('interest_signal', e.target.value)}
                  >
                    <option value="saved">Saved</option>
                    <option value="swiped_right">Swiped right</option>
                  </select>
                  <input
                    id="blast-interest"
                    className="ui-input mono"
                    value={filters.interested_in}
                    placeholder="entity slug"
                    onChange={(e) => setFilter('interested_in', e.target.value)}
                  />
                </div>
                <p className="ui-field__help">
                  To text about one business&apos;s last-minute opening, use{' '}
                  <Link to="/booking/openings">Openings</Link> — it fills this in for you.
                </p>
              </div>
            </div>

            <div className="row-wrap">
              <Button loading={previewing} onClick={preview} disabled={!message.trim()}>
                Count audience
              </Button>
              <Button
                variant="primary"
                loading={sending}
                disabled={!message.trim() || audience === null || audience === 0}
                onClick={send}
              >
                {audience === null
                  ? 'Count the audience first'
                  : audience === 0
                    ? 'Nobody matches'
                    : `Send to ${audience}`}
              </Button>
              {audience !== null && (
                <Badge tone={audience > 0 ? 'success' : 'warning'}>
                  {audience} recipient{audience === 1 ? '' : 's'}
                </Badge>
              )}
            </div>

            {audience !== null && audience > 0 && (
              <Notice tone="warning" title="This sends real text messages">
                {audience} people will receive this immediately. There is no recall.
              </Notice>
            )}
          </div>
        </Card>

        <Card padded={false} title="History">
          <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
            {historyQuery.loading && <LoadingBlock />}
            {historyQuery.error && (
              <ErrorState error={historyQuery.error} onRetry={historyQuery.reload} />
            )}
            {!historyQuery.loading && !historyQuery.error && (
              <DataTable
                columns={[
                  columns.dateTime('created_at', 'Sent'),
                  {
                    key: 'message',
                    header: 'Message',
                    render: (row) => (
                      <span className="truncate" style={{ display: 'block', maxWidth: 420 }}>
                        {row.message}
                      </span>
                    ),
                  },
                  columns.number('sent', 'Delivered'),
                  columns.number('total', 'Targeted'),
                ]}
                rows={historyQuery.data || []}
                rowKey={(row, index) => row.id ?? index}
                searchPlaceholder="Search past blasts…"
                emptyTitle="No blasts sent"
                initialSort={{ key: 'created_at', direction: 'desc' }}
              />
            )}
          </div>
        </Card>
      </div>

      {confirmElement}
    </>
  );
}
