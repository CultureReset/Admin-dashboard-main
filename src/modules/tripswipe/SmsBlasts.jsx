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
 */

import { useState } from 'react';
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
  const [filters, setFilters] = useState({ city: '', tag: '', min_saves: '' });
  const [audience, setAudience] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirm, confirmElement] = useConfirm();

  const historyQuery = useAsync(
    async () => unwrapList(await api.get(endpoints.sms.blasts()), ['blasts']),
    [],
    { initialData: [] },
  );

  const body = () => ({
    message,
    ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '')),
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
                <label className="ui-field__label" htmlFor="blast-city">City</label>
                <input
                  id="blast-city"
                  className="ui-input"
                  value={filters.city}
                  placeholder="Any city"
                  onChange={(e) => setFilter('city', e.target.value)}
                />
              </div>
              <div className="ui-field">
                <label className="ui-field__label" htmlFor="blast-tag">Interest tag</label>
                <input
                  id="blast-tag"
                  className="ui-input"
                  value={filters.tag}
                  placeholder="Any interest"
                  onChange={(e) => setFilter('tag', e.target.value)}
                />
              </div>
              <div className="ui-field">
                <label className="ui-field__label" htmlFor="blast-saves">Minimum saves</label>
                <input
                  id="blast-saves"
                  className="ui-input"
                  type="number"
                  min="0"
                  value={filters.min_saves}
                  placeholder="0"
                  onChange={(e) => setFilter('min_saves', e.target.value)}
                />
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
