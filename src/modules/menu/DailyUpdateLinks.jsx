/**
 * Daily SMS update links.
 *
 * POST /api/update/generate     mint a one-time link for a business
 * POST /api/update/send-sms     text that link to the owner
 * GET  /api/update/status/:token check whether it has been used
 * GET  /api/update/today        what came in today
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
    async () => unwrapList(await api.get(endpoints.updateLinks.today()), ['updates', 'today']),
    [],
    { initialData: [] },
  );

  const entity = entities.find((e) => e.slug === slug);

  const generate = async () => {
    if (!slug) {
      toast.warning('Pick a business first.');
      return;
    }
    setBusy(true);
    setGenerated(null);
    try {
      const response = await api.post(endpoints.updateLinks.generate(), { entity_slug: slug });
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
    setBusy(true);
    try {
      await api.post(endpoints.updateLinks.sendSms(), {
        entity_slug: slug,
        phone: phone || entity?.phone || undefined,
      });
      toast.success(`Update link texted${phone ? ` to ${phone}` : ''}.`);
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
              <label className="ui-field__label" htmlFor="update-phone">Phone (optional)</label>
              <input
                id="update-phone"
                className="ui-input"
                type="tel"
                value={phone}
                placeholder={entity?.phone || 'Uses the business phone on file'}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="ui-field__help">
                Leave blank to use the number stored on the entity.
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

        <Card padded={false} title="Today's updates">
          <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
            {todayQuery.loading && <LoadingBlock />}
            {todayQuery.error && <ErrorState error={todayQuery.error} onRetry={todayQuery.reload} />}
            {!todayQuery.loading && !todayQuery.error && (todayQuery.data || []).length === 0 && (
              <EmptyState
                icon="✉️"
                title="Nothing today"
                description="No owner has posted an update yet."
              />
            )}
            {!todayQuery.loading && !todayQuery.error && (todayQuery.data || []).length > 0 && (
              <DataTable
                columns={[
                  columns.primary('entity_slug', 'Business'),
                  columns.text('menu_text', 'Menu'),
                  columns.text('specials_text', 'Specials'),
                  columns.dateTime('created_at', 'Posted'),
                ]}
                rows={todayQuery.data}
                rowKey={(row, index) => row.id ?? index}
                searchPlaceholder="Search updates…"
                initialSort={{ key: 'created_at', direction: 'desc' }}
              />
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
