/**
 * Sales and onboarding pages per listing.
 *
 * These pages are generated from the entity itself, so this screen builds the
 * links from the entity list rather than calling a route for them. The invite
 * flow uses POST /api/admin/invite-business, which does exist.
 */

import { useMemo, useState } from 'react';
import { Button, Card, Notice, PageHeader } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useEntities } from '../../components/EntityPicker.jsx';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { config } from '../../config/env.js';
import { columns, fields } from '../../lib/fields.jsx';

/**
 * Where the public site lives. Configurable, because this dashboard must not
 * hardcode the front-end's hostname any more than it hardcodes the API's.
 */
const publicBase = config.publicSiteUrl;

const inviteSchema = [fields.email('email', 'Owner email', { required: true, span: 2 })];

export default function SalesPages() {
  const toast = useToast();
  const { entities, loading, error, reload } = useEntities();
  const [inviteFor, setInviteFor] = useState(null);
  const [copied, setCopied] = useState(null);

  const rows = useMemo(
    () =>
      entities.map((entity) => ({
        ...entity,
        __claim: publicBase ? `${publicBase}/claim?slug=${encodeURIComponent(entity.slug)}` : null,
        __public: publicBase ? `${publicBase}/${encodeURIComponent(entity.slug)}` : null,
      })),
    [entities],
  );

  const copy = async (value, key) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.warning('Could not copy — your browser blocked clipboard access.');
    }
  };

  const invite = async (values) => {
    await api.post(endpoints.businesses.invite(), {
      entity_slug: inviteFor.slug,
      email: values.email,
    });
    toast.success(`Invitation sent to ${values.email}.`);
    setInviteFor(null);
  };

  return (
    <>
      <PageHeader
        title="Sales pages"
        description="Claim and preview links for each listing, and owner invitations."
        actions={<Button onClick={reload} disabled={loading}>Refresh</Button>}
      />

      {!publicBase && (
        <>
          <Notice tone="warning" title="Public site URL not configured">
            Set <code className="mono">VITE_PUBLIC_SITE_URL</code> (or{' '}
            <code className="mono">window.__ADMIN_CONFIG__.publicSiteUrl</code>) so this screen can
            build claim and preview links. Invitations work regardless — the API builds that URL
            itself.
          </Notice>
          <div style={{ height: 'var(--space-4)' }} />
        </>
      )}

      <Card padded={false}>
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <DataTable
            columns={[
              columns.thumb('hero_image_url'),
              columns.primary('name', 'Business', 'slug'),
              columns.text('city', 'City'),
              {
                key: '__links',
                header: 'Links',
                sortable: false,
                searchable: false,
                stopPropagation: true,
                render: (row) =>
                  publicBase ? (
                    <span className="row" style={{ gap: 6 }}>
                      <a href={row.__public} target="_blank" rel="noreferrer noopener">Public</a>
                      <a href={row.__claim} target="_blank" rel="noreferrer noopener">Claim</a>
                      <Button size="sm" variant="link" onClick={() => copy(row.__claim, row.slug)}>
                        {copied === row.slug ? 'Copied' : 'Copy claim link'}
                      </Button>
                    </span>
                  ) : (
                    <span className="faint">Configure the public site URL</span>
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
                  <Button size="sm" onClick={() => setInviteFor(row)}>Invite owner</Button>
                ),
              },
            ]}
            rows={rows}
            loading={loading}
            error={error}
            onRetry={reload}
            rowKey="slug"
            searchPlaceholder="Search businesses…"
            emptyTitle="No businesses"
            initialSort={{ key: 'name', direction: 'asc' }}
          />
        </div>
      </Card>

      <Modal
        open={Boolean(inviteFor)}
        onClose={() => setInviteFor(null)}
        title="Invite the owner"
        description={inviteFor ? `They will be able to claim ${inviteFor.name}.` : undefined}
      >
        <SchemaForm
          schema={inviteSchema}
          columns={1}
          onSubmit={invite}
          onCancel={() => setInviteFor(null)}
          submitLabel="Send invitation"
        />
      </Modal>
    </>
  );
}
