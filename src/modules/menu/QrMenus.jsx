/**
 * QR menus — the public menu view each business's QR code points at.
 *
 * GET /api/menu-editor/:slug/qr-menu confirms a slug renders a QR menu.
 */

import { useMemo, useState } from 'react';
import { Badge, Button, Card, ErrorState, LoadingBlock, Notice, PageHeader } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useEntities } from '../../components/EntityPicker.jsx';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { config } from '../../config/env.js';
import { columns } from '../../lib/fields.jsx';

export default function QrMenus() {
  const toast = useToast();
  const { entities, loading, error, reload } = useEntities();
  const [preview, setPreview] = useState(null);
  const [copied, setCopied] = useState(null);

  const rows = useMemo(
    () =>
      entities.map((entity) => ({
        ...entity,
        __menuUrl: config.publicSiteUrl
          ? `${config.publicSiteUrl}/m/${encodeURIComponent(entity.slug)}`
          : null,
      })),
    [entities],
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

  return (
    <>
      <PageHeader
        title="QR menus"
        description="The public menu each business's QR code opens."
        actions={<Button onClick={reload} disabled={loading}>Refresh</Button>}
      />

      {!config.publicSiteUrl && (
        <>
          <Notice tone="warning" title="Public site URL not configured">
            Set <code className="mono">VITE_PUBLIC_SITE_URL</code> so menu links can be built.
            Previewing the menu data works regardless — it reads from the API directly.
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
              columns.text('entity_subtype', 'Type'),
              columns.text('city', 'City'),
              {
                key: '__link',
                header: 'Menu link',
                sortable: false,
                searchable: false,
                stopPropagation: true,
                render: (row) =>
                  row.__menuUrl ? (
                    <span className="row" style={{ gap: 6 }}>
                      <a href={row.__menuUrl} target="_blank" rel="noreferrer noopener">Open</a>
                      <Button size="sm" variant="link" onClick={() => copy(row.__menuUrl, row.slug)}>
                        {copied === row.slug ? 'Copied' : 'Copy'}
                      </Button>
                    </span>
                  ) : (
                    <span className="faint">—</span>
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
                  <Button size="sm" onClick={() => setPreview(row)}>Preview data</Button>
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
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        size="lg"
        title={preview ? `QR menu — ${preview.name}` : ''}
      >
        {preview && <QrMenuPreview slug={preview.slug} />}
      </Modal>
    </>
  );
}

function QrMenuPreview({ slug }) {
  const { data, loading, error, reload } = useAsync(
    async () => api.get(endpoints.menu.editorQrMenu(slug), { auth: false }),
    [slug],
    { initialData: null },
  );

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const raw = data?.menu_sections ?? data?.sections;
  const sections = Array.isArray(raw) ? raw : [];

  return (
    <div className="stack">
      <div className="row-wrap">
        <Badge tone="info">{sections.length} sections</Badge>
        <Badge>
          {sections.reduce((n, section) => n + (section.items?.length || 0), 0)} items
        </Badge>
      </div>

      {sections.length === 0 ? (
        <p className="muted">This business has no menu sections yet.</p>
      ) : (
        sections.map((section) => (
          <div key={section.id || section.section_name}>
            <h3 style={{ fontSize: 14, marginBottom: 6 }}>{section.section_name}</h3>
            <ul className="stack-sm" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {(section.items || []).map((item) => (
                <li className="row" key={item.id || item.item_name}>
                  <span style={{ flex: 1 }}>{item.item_name}</span>
                  <span className="mono faint">
                    {item.has_market_price ? 'Market' : item.price != null ? `$${item.price}` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
