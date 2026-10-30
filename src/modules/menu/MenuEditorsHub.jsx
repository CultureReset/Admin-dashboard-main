/**
 * Menu editors hub.
 *
 * The standalone slug-based editor (routes/menu-editor.js) lets an owner edit
 * their own menu with a PIN and no account. This screen lists every business
 * with a link into that editor, plus the PIN status so it is obvious who can
 * actually get in.
 *
 * GET /api/menu-editor/:slug/data  is used to confirm the editor has data.
 */

import { useMemo, useState } from 'react';
import { Badge, Button, Card, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useEntities } from '../../components/EntityPicker.jsx';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { config } from '../../config/env.js';
import { columns } from '../../lib/fields.jsx';

export default function MenuEditorsHub() {
  const toast = useToast();
  const { entities, loading, error, reload } = useEntities();
  const [checking, setChecking] = useState(null);
  const [checks, setChecks] = useState({});

  const rows = useMemo(
    () =>
      entities.map((entity) => ({
        ...entity,
        __editorUrl: config.publicSiteUrl
          ? `${config.publicSiteUrl}/menu-editor?slug=${encodeURIComponent(entity.slug)}`
          : null,
      })),
    [entities],
  );

  /** Confirm the standalone editor can load data for this slug. */
  const check = async (entity) => {
    setChecking(entity.slug);
    try {
      const data = await api.get(endpoints.menu.editorData(entity.slug), { auth: false });
      const sections = data?.menu_sections?.length ?? data?.sections?.length ?? 0;
      setChecks((prev) => ({ ...prev, [entity.slug]: { ok: true, sections } }));
      toast.success(`${entity.name}: editor loaded ${sections} sections.`);
    } catch (err) {
      setChecks((prev) => ({ ...prev, [entity.slug]: { ok: false, message: err.message } }));
      toast.error(err);
    } finally {
      setChecking(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Menu editors hub"
        description="Links into the standalone, PIN-protected menu editor for each business."
        actions={<Button onClick={reload} disabled={loading}>Refresh</Button>}
      />

      <Notice tone="info" title="How the standalone editor works">
        <p>
          <code className="mono">/api/menu-editor/:slug</code> lets an owner edit their menu with a
          PIN instead of an account. The PIN is the <code>menu_pin</code> column on the entity —
          set it on the Entity Editor&apos;s Info tab.
        </p>
        {!config.publicSiteUrl && (
          <p style={{ marginTop: 8 }}>
            Set <code className="mono">VITE_PUBLIC_SITE_URL</code> to generate direct editor links.
          </p>
        )}
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="Businesses" value={entities.length} />
        <Stat
          label="Checked this session"
          value={Object.keys(checks).length}
          hint={`${Object.values(checks).filter((c) => c.ok).length} loaded successfully`}
        />
      </div>

      <Card padded={false}>
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <DataTable
            columns={[
              columns.thumb('hero_image_url'),
              columns.primary('name', 'Business', 'slug'),
              columns.text('entity_subtype', 'Type'),
              columns.text('city', 'City'),
              {
                key: '__check',
                header: 'Editor',
                sortable: false,
                searchable: false,
                render: (row) => {
                  const result = checks[row.slug];
                  if (!result) return <span className="faint">Not checked</span>;
                  return result.ok ? (
                    <Badge tone="success">{result.sections} sections</Badge>
                  ) : (
                    <Badge tone="danger">{result.message}</Badge>
                  );
                },
              },
              {
                key: '__actions',
                header: '',
                align: 'right',
                sortable: false,
                searchable: false,
                stopPropagation: true,
                render: (row) => (
                  <span className="ui-cell-actions">
                    <Button
                      size="sm"
                      loading={checking === row.slug}
                      onClick={() => check(row)}
                    >
                      Check
                    </Button>
                    {row.__editorUrl && (
                      <a
                        className="ui-btn ui-btn--sm"
                        href={row.__editorUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Open editor
                      </a>
                    )}
                  </span>
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
    </>
  );
}
