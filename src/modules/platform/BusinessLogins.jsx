/**
 * Business logins.
 *
 * Every business already has a listing full of data; what it needs is a way in.
 * Pick one, get a one-time link, and send it by email, by text, both, or copy
 * it and deliver it yourself. The business opens the link, picks a password,
 * and lands in its own dashboard — no account to create first.
 *
 * Nothing here names a business in source. Delivery is always an explicit
 * button press (and a confirm for email/text); "Create link" sends nothing.
 *
 * GET  /api/admin/business-invites/coverage
 * GET  /api/admin/business-invites?slug=
 * POST /api/admin/business-invites   { slug, channel, email?, phone? }
 */

import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { useAsync } from '../../hooks/useAsync.js';
import { EntityPicker, useEntities } from '../../components/EntityPicker.jsx';
import {
  PageHeader, Card, Badge, Button, Notice, Stat, LoadingBlock, ErrorState, EmptyState,
} from '../../ui/primitives.jsx';
import { useToast } from '../../ui/Toast.jsx';
import '../../ui/Field.css';

const when = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

function statusTone(status) {
  if (status === 'accepted') return 'success';
  if (status === 'pending') return 'info';
  return 'neutral';
}

export default function BusinessLogins() {
  const toast = useToast();
  const { selectedSlug, setSelectedSlug, selected } = useEntities();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState(null);

  const coverage = useAsync(async () => api.get(endpoints.businessInvites.coverage()), [], { initialData: null });
  const invites = useAsync(
    async () => (selectedSlug ? api.get(endpoints.businessInvites.list(), { query: { slug: selectedSlug } }) : { invites: [] }),
    [selectedSlug],
    { initialData: { invites: [] } },
  );

  // Start from what's on file; the admin can correct it before sending.
  useEffect(() => {
    setEmail(selected?.email || '');
    setPhone(selected?.phone || '');
    setResult(null);
  }, [selected?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const issue = async (channel) => {
    if (!selectedSlug) return;
    const dest = { email: email.trim(), sms: phone.trim() };
    const where = channel === 'email' ? dest.email : channel === 'sms' ? dest.sms : `${dest.email} and ${dest.sms}`;
    if (channel !== 'none' && !window.confirm(`Send ${selected?.name || selectedSlug}'s dashboard link to ${where}?`)) return;
    setBusy(channel);
    try {
      const out = await api.post(endpoints.businessInvites.create(), {
        slug: selectedSlug,
        channel,
        email: dest.email || undefined,
        phone: dest.sms || undefined,
        force: result?.needsForce || undefined,
      });
      setResult(out);
      const failed = [out.sent?.email, out.sent?.sms].filter((s) => s && !s.ok);
      if (failed.length) toast.error(`Link created, but ${failed.length === 1 ? 'one message' : 'the messages'} did not send.`);
      else toast.success(channel === 'none' ? 'Link created' : 'Link sent', 'Done');
      coverage.run(); invites.run();
    } catch (e) {
      if (e.status === 409 && e.body?.already_owned) {
        setResult({ needsForce: true });
      } else {
        toast.error(e);
      }
    } finally {
      setBusy('');
    }
  };

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast.success('Link copied', 'Copied'); }
    catch { toast.error('Copy failed — select the link and copy it by hand.'); }
  };

  const c = coverage.data;

  return (
    <>
      <PageHeader
        title="Business logins"
        description="Every business already has a listing. Give it a way in: a one-time link to its own dashboard."
      />

      {coverage.loading && !c ? <LoadingBlock /> : null}
      <ErrorState error={coverage.error} onRetry={coverage.run} context="login coverage" />
      {c && (
        <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
          <Stat label="Active businesses" value={c.active_businesses} />
          <Stat label="Have a login" value={c.with_login} tone="success" hint={`${c.invite_pending} link${c.invite_pending === 1 ? '' : 's'} waiting to be opened`} />
          <Stat label="No login yet" value={c.no_login_yet} tone={c.no_login_yet ? 'warning' : 'success'} />
          <Stat label="…reachable by email" value={c.reachable.email} />
          <Stat label="…reachable by text only" value={c.reachable.phone_only} />
          <Stat label="…no contact on file" value={c.reachable.neither} hint="Copy the link and deliver it by hand" />
        </div>
      )}

      <Card title="Send a business its dashboard">
        <EntityPicker value={selectedSlug} onChange={(slug) => setSelectedSlug(slug)} />

        {!selectedSlug ? (
          <EmptyState icon="🔑" title="Choose a business" description="Search for the business you're handing a dashboard to." />
        ) : (
          <>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', margin: '16px 0' }}>
              <label>
                <span className="ui-field__label" style={{ display: 'block', marginBottom: 4 }}>Email</span>
                <input className="ui-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@business.com" />
              </label>
              <label>
                <span className="ui-field__label" style={{ display: 'block', marginBottom: 4 }}>Mobile</span>
                <input className="ui-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(251) 555-0123" />
              </label>
            </div>

            {result?.needsForce && (
              <Notice tone="warning" title="This business already has a login">
                Sending a new link lets someone else in as well. Press a button again to continue.
              </Notice>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="primary" loading={busy === 'none'} onClick={() => issue('none')}>Create link</Button>
              <Button loading={busy === 'email'} disabled={!email.trim()} onClick={() => issue('email')}>Email it</Button>
              <Button loading={busy === 'sms'} disabled={!phone.trim()} onClick={() => issue('sms')}>Text it</Button>
              <Button loading={busy === 'both'} disabled={!email.trim() || !phone.trim()} onClick={() => issue('both')}>Email + text</Button>
            </div>
            {!email.trim() && !phone.trim() && (
              <p style={{ marginTop: 8 }}>No email or mobile on file — create the link and deliver it by hand.</p>
            )}

            {result?.claim_url && (
              <div style={{ marginTop: 16 }}>
                <Notice tone="success" title={`Dashboard link for ${result.business_name}`}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input className="ui-input mono" readOnly value={result.claim_url} style={{ flex: 1, minWidth: 220 }} onFocus={(e) => e.target.select()} />
                    <Button size="sm" onClick={() => copy(result.claim_url)}>Copy</Button>
                  </div>
                  <p style={{ margin: '8px 0 0' }}>One-time link, expires in {result.expires_in_days} days. {result.login_hint}</p>
                  {result.sent?.email && <p style={{ margin: '4px 0 0' }}>Email to {result.sent.email.to}: {result.sent.email.ok ? 'sent' : `failed${result.sent.email.error ? ` (${result.sent.email.error})` : ''}`}</p>}
                  {result.sent?.sms && <p style={{ margin: '4px 0 0' }}>Text to {result.sent.sms.to}: {result.sent.sms.ok ? 'sent' : `not sent${result.sent.sms.reason ? ` (${result.sent.sms.reason.replace(/_/g, ' ')})` : ''}`}</p>}
                </Notice>
              </div>
            )}
          </>
        )}
      </Card>

      {selectedSlug && (
        <Card title="Links issued for this business">
          {invites.loading ? <LoadingBlock /> : null}
          <ErrorState error={invites.error} onRetry={invites.run} context="invites" />
          {!invites.loading && (invites.data?.invites || []).length === 0 ? (
            <p style={{ color: 'var(--text-faint)' }}>No links issued yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
              {(invites.data?.invites || []).map((i) => (
                <li key={i.id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Badge tone={statusTone(i.status)}>{i.status}</Badge>
                  <span>{i.email}</span>
                  <span style={{ color: 'var(--text-faint)' }}>sent {when(i.created_at)}</span>
                  {i.accepted_at && <span style={{ color: 'var(--text-faint)' }}>opened {when(i.accepted_at)}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
