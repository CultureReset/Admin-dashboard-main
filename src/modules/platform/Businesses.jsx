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
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Stat } from '../../ui/primitives.jsx';
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
  fields.email('email', 'Owner email', { required: true, span: 2 }),
];

const linkSchema = [
  fields.email('user_email', 'User email', { required: true, span: 2 }),
  fields.select('role', 'Role', ['owner', 'manager', 'staff'], { defaultValue: 'owner' }),
];

export default function PlatformBusinesses() {
  const toast = useToast();
  const [ownersFor, setOwnersFor] = useState(null);
  const [inviteFor, setInviteFor] = useState(null);

  const { data, loading, error, reload } = useAsync(
    async () => unwrapList(await api.get(endpoints.businesses.list()), ['businesses']),
    [],
    { initialData: [] },
  );

  const businesses = data || [];

  const invite = async (values) => {
    await api.post(endpoints.businesses.invite(), {
      entity_slug: inviteFor,
      email: values.email,
    });
    toast.success(`Invitation sent to ${values.email}.`);
    setInviteFor(null);
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
          onSubmit={invite}
          onCancel={() => setInviteFor(null)}
          submitLabel="Send invitation"
          columns={1}
        />
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
