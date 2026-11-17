/**
 * Daily SMS update links.
 *
 * POST /api/update/generate     mint a one-time link for a business
 * POST /api/update/send-sms     text that link to the owner
 * GET  /api/update/today        every link minted today, and whether it was used
 *
 * Both POSTs key the link on the entity's numeric `entity_id` (not its slug),
 * and send-sms needs an explicit `phone` — the entity list carries no phone
 * number to fall back on. send-sms answers 200 `{ success: false }` when
 * Twilio is not configured, so that case is checked rather than toasted as sent.
 *
 * The link lets an owner post today's menu and specials from their phone
 * without signing in.
 */

import { useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { EntityPicker, useEntities } from '../../components/EntityPicker.jsx';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, formatDateTime } from '../../lib/fields.jsx';

export default function DailyUpdateLinks() {
  const toast = useToast();
  const { entities } = useEntities();
  const [slug, setSlug] = useState(null);
  const [phone, setPhone] = useState('');
  const [generated, setGenerated] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const todayQuery = useAsync(
    async () => unwrapList(await api.get(endpoints.updateLinks.today()), ['links']),
    [],
    { initialData: [] },
  );

  const entity = entities.find((e) => e.slug === slug);

  const generate = async () => {
    if (!slug) {
      toast.warning('Pick a business first.');
      return;
    }
    if (!entity?.id) {
      toast.warning('That business has no entity id to key the link on.');
      return;
    }
    setBusy(true);
    setGenerated(null);
    try {
      const response = await api.post(endpoints.updateLinks.generate(), {
        entity_id: entity.id,
        biz_name: entity.name,
      });
      setGenerated(response);
      toast.success('Link generated.');
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const sendSms = async () => {
    if (!slug) {
      toast.warning('Pick a business first.');
      return;
    }
    if (!phone.trim()) {
      toast.warning('Enter the owner’s mobile number to text the link to.');
      return;
    }
    if (!entity?.id) {
      toast.warning('That business has no entity id to key the link on.');
      return;
    }
    setBusy(true);
    try {
      const response = await api.post(endpoints.updateLinks.sendSms(), {
        entity_id: entity.id,
        biz_name: entity.name,
        phone: phone.trim(),
      });
      if (response?.url) setGenerated(response);
      if (response?.success === false) {
        toast.warning(`Not sent: ${response.error || 'SMS is unavailable'}. The link is below to send by hand.`);
      } else {
        toast.success(`Update link texted to ${phone.trim()}.`);
        todayQuery.reload().catch(() => {});
      }
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    const url = generated?.url || generated?.link;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.warning('Your browser blocked clipboard access.');
    }
  };

  const link = generated?.url || generated?.link;

  return (
    <>
      <PageHeader
        title="Daily SMS links"
        description="One-time links owners use to post today's menu and specials from their phone."
        actions={<Button onClick={todayQuery.reload}>Refresh today</Button>}
      />

      <div className="stack">
        <Card
          title="Generate a link"
          actions={
            <>
              <Button loading={busy} onClick={generate} disabled={!slug}>Generate</Button>
              <Button variant="primary" loading={busy} onClick={sendSms} disabled={!slug}>
                Text it to the owner
              </Button>
            </>
          }
        >
          <div className="stack">
            <EntityPicker value={slug} onChange={setSlug} label="Business" />

            <div className="ui-field" style={{ maxWidth: 320 }}>
              <label className="ui-field__label" htmlFor="update-phone">Owner’s mobile</label>
              <input
                id="update-phone"
                className="ui-input"
                type="tel"
                value={phone}
                placeholder="+1 251 555 0100"
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="ui-field__help">
                Needed to text the link. Generating a link to copy does not need it.
              </p>
            </div>

            {link && (
              <div className="stack-sm">
                <div className="ui-field__label">Generated link</div>
                <div className="row-wrap">
                  <a href={link} target="_blank" rel="noreferrer noopener" className="mono">
                    {link}
                  </a>
                  <Button size="sm" onClick={copyLink}>{copied ? 'Copied' : 'Copy'}</Button>
                  {generated.expires_at && (
                    <Badge tone="warning">Expires {formatDateTime(generated.expires_at)}</Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card padded={false} title="Today's links">
          <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
            {todayQuery.loading && <LoadingBlock />}
            {todayQuery.error && <ErrorState error={todayQuery.error} onRetry={todayQuery.reload} />}
            {!todayQuery.loading && !todayQuery.error && (todayQuery.data || []).length === 0 && (
              <EmptyState
                icon="✉️"
                title="Nothing today"
                description="No update links have been generated today."
              />
            )}
            {!todayQuery.loading && !todayQuery.error && (todayQuery.data || []).length > 0 && (
              <DataTable
                columns={[
                  columns.primary('entity_name', 'Business', 'entity_slug'),
                  columns.text('link_type', 'Type'),
                  columns.dateTime('created_at', 'Generated'),
                  {
                    key: 'submitted_at',
                    header: 'Used',
                    render: (row) =>
                      row.submitted_at ? (
                        <Badge tone="success">{formatDateTime(row.submitted_at)}</Badge>
                      ) : (
                        <Badge>Not yet</Badge>
                      ),
                  },
                  columns.link('url', 'Link', { label: 'Open' }),
                ]}
                rows={todayQuery.data}
                rowKey={(row, index) => row.id ?? row.token ?? index}
                searchPlaceholder="Search links…"
                initialSort={{ key: 'created_at', direction: 'desc' }}
              />
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
