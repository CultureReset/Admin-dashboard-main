/**
 * CyberCheck business accounts and their links to GCR listings.
 *
 * GET    /api/admin/businesses
 * GET    /api/admin/link-user?entity_slug=…
 * POST   /api/admin/link-user     { user_email, entity_slug, role }
 * DELETE /api/admin/link-user     { user_email, entity_slug }
 * POST   /api/admin/invite-business { entity_slug, email }
 */

import { useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { Modal, useConfirm } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, fields } from '../../lib/fields.jsx';

const inviteSchema = [
  fields.email('email', 'Owner email', {
    required: true,
    span: 2,
    help: 'The address the account is created under. They sign in with it afterwards.',
  }),
  fields.bool('send', 'Email the link now', {
    span: 2,
    help: 'Turn off to just get the link and send it yourself.',
  }),
];

const linkSchema = [
  fields.email('user_email', 'User email', { required: true, span: 2 }),
  fields.select('role', 'Role', ['owner', 'manager', 'staff'], { defaultValue: 'owner' }),
];

export default function PlatformBusinesses() {
  const toast = useToast();
  const [ownersFor, setOwnersFor] = useState(null);
  const [inviteFor, setInviteFor] = useState(null);
  const [inviteResult, setInviteResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const { data, loading, error, reload } = useAsync(
    async () => unwrapList(await api.get(endpoints.businesses.list()), ['businesses']),
    [],
    { initialData: [] },
  );

  const businesses = data || [];

  // The link is the deliverable, not the email. Until an SMS sender is
  // approved, the reliable way to reach an owner is to hand them the URL and
  // send it yourself — so the result stays on screen to be copied whether the
  // email went out or not.
  const invite = async (values) => {
    const result = await api.post(endpoints.businesses.invite(), {
      entity_slug: inviteFor,
      email: values.email,
      send: values.send !== false,
    });
    setInviteResult({ ...result, entity_slug: inviteFor });
    setInviteFor(null);
    if (result?.sent) toast.success(`Invitation emailed to ${values.email}.`);
    else if (result?.send_error) toast.error(`Link created, but the email failed: ${result.send_error}`);
    else toast.success('Invite link created.');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteResult.claim_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked outside a secure context. The input below holds
      // the same URL and is selectable, so this is not a dead end.
      toast.error('Could not copy automatically — select the link and copy it.');
    }
  };

  return (
    <>
      <PageHeader
        title="Businesses"
        description="CyberCheck accounts, and who owns which GCR listing."
        actions={<Button onClick={reload} disabled={loading}>Refresh</Button>}
      />

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="Accounts" value={businesses.length} tone="primary" />
        <Stat
          label="With a linked entity"
          value={businesses.filter((b) => b.entity_slug || b.gcr_slug).length}
        />
      </div>

      <Card
        title="Entity ownership"
        subtitle="Look up or change who controls a GCR listing."
        actions={
          <>
            <Button size="sm" disabled={!ownersFor} onClick={() => setInviteFor(ownersFor)}>
              Invite an owner
            </Button>
          </>
        }
      >
        <EntityPicker value={ownersFor} onChange={setOwnersFor} label="Listing" />
        {ownersFor && (
          <>
            <div style={{ height: 'var(--space-4)' }} />
            <OwnerList slug={ownersFor} />
          </>
        )}
      </Card>

      <div style={{ height: 'var(--space-5)' }} />

      <Card padded={false} title="Accounts">
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <DataTable
            columns={[
              columns.primary('name', 'Business', 'domain'),
              columns.text('email', 'Email'),
              columns.text('entity_slug', 'GCR listing'),
              columns.text('plan', 'Plan'),
              {
                key: 'status',
                header: 'Status',
                render: (row) =>
                  row.status ? (
                    <Badge tone={row.status === 'active' ? 'success' : 'neutral'}>{row.status}</Badge>
                  ) : (
                    <span className="faint">—</span>
                  ),
              },
              columns.dateTime('created_at', 'Created'),
            ]}
            rows={businesses}
            loading={loading}
            error={error}
            onRetry={reload}
            searchPlaceholder="Search accounts…"
            emptyTitle="No business accounts"
            initialSort={{ key: 'created_at', direction: 'desc' }}
          />
        </div>
      </Card>

      <Modal
        open={Boolean(inviteFor)}
        onClose={() => setInviteFor(null)}
        title="Invite a business owner"
        description={inviteFor ? `They will be able to claim ${inviteFor}.` : undefined}
      >
        <SchemaForm
          schema={inviteSchema}
          initialValues={{ send: true }}
          onSubmit={invite}
          onCancel={() => setInviteFor(null)}
          submitLabel="Create invite"
          columns={1}
        />
      </Modal>

      <Modal
        open={Boolean(inviteResult)}
        onClose={() => { setInviteResult(null); setCopied(false); }}
        title="Invite link"
        description={
          inviteResult
            ? `${inviteResult.business_name || inviteResult.entity_slug} — for ${inviteResult.email}`
            : undefined
        }
      >
        {inviteResult && (
          <div className="stack">
            <Notice tone={inviteResult.sent ? 'success' : 'info'}>
              {inviteResult.sent
                ? `Emailed to ${inviteResult.email}. You can also send this link yourself.`
                : inviteResult.send_error
                  ? `The email did not go out (${inviteResult.send_error}), but the link works — send it yourself.`
                  : 'No email was sent. Copy the link and send it however you like.'}
            </Notice>

            {/* Readonly rather than disabled so it stays selectable when the
                clipboard API is unavailable. */}
            <input
              className="ui-input mono"
              readOnly
              value={inviteResult.claim_url}
              onFocus={(e) => e.target.select()}
              aria-label="Invite link"
            />

            <div className="row-wrap" style={{ gap: 'var(--space-2)' }}>
              <Button variant="primary" onClick={copyLink}>
                {copied ? '✓ Copied' : 'Copy link'}
              </Button>
              {/* Plain anchors, styled as buttons — Button always renders a
                  <button>, which ignores href. These hand off to whatever the
                  machine uses for SMS and mail, so the link goes out from you
                  rather than from the platform. */}
              <a
                className="ui-btn ui-btn--default ui-btn--md"
                href={`sms:?&body=${encodeURIComponent(
                  `Set up your ${inviteResult.business_name || 'business'} listing: ${inviteResult.claim_url}`,
                )}`}
              >
                <span>Text it</span>
              </a>
              <a
                className="ui-btn ui-btn--default ui-btn--md"
                href={`mailto:${encodeURIComponent(inviteResult.email)}?subject=${encodeURIComponent(
                  `Set up ${inviteResult.business_name || 'your listing'}`,
                )}&body=${encodeURIComponent(inviteResult.claim_url)}`}
              >
                <span>Email it</span>
              </a>
            </div>

            <p className="faint">
              Single use, expires in {inviteResult.expires_in_days || 14} days. Whoever
              opens it sets a password and takes over the listing, so treat it like one.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}

/** Who is linked to one entity, with add and remove. */
function OwnerList({ slug }) {
  const toast = useToast();
  const [linking, setLinking] = useState(false);
  const [confirm, confirmElement] = useConfirm();

  const { data, loading, error, reload } = useAsync(
    async () =>
      unwrapList(await api.get(endpoints.businesses.linkUser(), { query: { entity_slug: slug } }), [
        'links',
        'users',
      ]),
    [slug],
    { initialData: [] },
  );

  const links = data || [];

  const addLink = async (values) => {
    await api.post(endpoints.businesses.linkUser(), { ...values, entity_slug: slug });
    toast.success(`${values.user_email} linked to ${slug}.`);
    setLinking(false);
    await reload();
  };

  const removeLink = async (link) => {
    const email = link.user_email || link.email;
    const ok = await confirm({
      title: 'Remove access',
      message: `Remove ${email}'s access to ${slug}?`,
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    try {
      await api.del(endpoints.businesses.linkUser(), {
        body: { user_email: email, entity_slug: slug },
      });
      toast.success('Access removed.', 'Removed');
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <div className="stack">
      {loading && <LoadingBlock />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && links.length === 0 && (
        <EmptyState icon="🔑" title="No linked users" description="Nobody controls this listing yet." />
      )}

      {!loading && !error && links.length > 0 && (
        <ul className="sec-editor__items">
          {links.map((link, index) => (
            <li className="sec-editor__item" key={link.id || link.user_email || index}>
              <div className="sec-editor__itembody">
                <div className="sec-editor__itemname">
                  {link.user_email || link.email}
                  {link.role && <Badge tone="info">{link.role}</Badge>}
                </div>
              </div>
              <Button size="sm" variant="danger" onClick={() => removeLink(link)}>Remove</Button>
            </li>
          ))}
        </ul>
      )}

      {linking ? (
        <SchemaForm
          schema={linkSchema}
          onSubmit={addLink}
          onCancel={() => setLinking(false)}
          submitLabel="Link user"
        />
      ) : (
        <div>
          <Button onClick={() => setLinking(true)}>Link a user</Button>
        </div>
      )}

      {confirmElement}
    </div>
  );
}
