/**
 * Composio connections.
 *
 * Two things on one screen, because they only make sense together:
 *   the catalog      which tools are on offer (platform_connections)
 *   the connections  which business has connected which tool (entity_connections)
 *
 * The Composio API key never reaches this browser. When the server does not
 * have one, /connect answers 501 and this screen says exactly that instead of
 * showing a button that fails.
 *
 * GET/POST/PUT/DELETE /api/admin/connections/catalog
 * GET /api/admin/connections            GET /api/admin/connections/status
 * GET /api/admin/connections/available
 * POST /api/admin/connections/:slug/:toolId/connect | /refresh
 * DELETE /api/admin/connections/:slug/:toolId
 */

import { useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { Modal, useConfirm } from '../../ui/Modal.jsx';
import { TabBar } from '../../ui/Tabs.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, fields } from '../../lib/fields.jsx';

const TABS = [
  { id: 'connections', label: 'Connections' },
  { id: 'catalog', label: 'Tool catalog' },
];

const STATUS_TONES = { connected: 'success', pending: 'warning', disconnected: 'neutral' };

export default function Connections() {
  const toast = useToast();
  const [tab, setTab] = useState('connections');
  const [slug, setSlug] = useState(null);
  const [editingTool, setEditingTool] = useState(null);
  const [connectFor, setConnectFor] = useState(null);
  const [busy, setBusy] = useState(null);
  const [confirm, confirmElement] = useConfirm();

  const statusQuery = useAsync(
    async () => api.get(endpoints.connections.status()),
    [],
    { initialData: null },
  );

  const catalogQuery = useAsync(
    async () => api.get(endpoints.connections.catalog()),
    [],
    { initialData: null },
  );

  const connectionsQuery = useAsync(
    async () =>
      unwrapList(
        await api.get(endpoints.connections.list(), { query: { slug: slug || undefined } }),
        ['connections'],
      ),
    [slug],
    { initialData: [] },
  );

  const status = statusQuery.data || {};
  const tools = catalogQuery.data?.tools || [];
  const categories = catalogQuery.data?.categories || [];
  const connections = connectionsQuery.data || [];

  const toolSchema = useMemo(
    () => ({
      groups: [
        {
          title: 'Tool',
          fields: [
            fields.text('tool_id', 'Tool ID', {
              required: true,
              help: 'Stable identifier, e.g. google-calendar.',
              validate: (v) =>
                v && !/^[a-z0-9_-]+$/.test(v) ? 'Lowercase letters, numbers, hyphens' : null,
            }),
            fields.text('name', 'Name', { required: true }),
            fields.textarea('description', 'Description', { rows: 2 }),
            fields.select('cat', 'Category', categories.map((c) => ({ value: c.cat_id, label: c.name }))),
            fields.image('logo', 'Logo URL'),
            fields.text('icon', 'Icon', { placeholder: 'emoji fallback' }),
          ],
        },
        {
          title: 'Composio',
          description: 'Without an integration id, a business cannot connect this tool.',
          fields: [
            fields.text('composio_app', 'Composio app key', { placeholder: 'googlecalendar' }),
            fields.text('integration_id', 'Composio integration id', { span: 2 }),
            fields.text('auth_scheme', 'Auth scheme', { placeholder: 'OAUTH2' }),
          ],
        },
        {
          title: 'Placement',
          fields: [
            fields.sortOrder(),
            fields.bool('is_featured', 'Featured'),
            fields.bool('is_active', 'Listed', { defaultValue: true }),
          ],
        },
      ],
    }),
    [categories],
  );

  const saveTool = async (values) => {
    if (editingTool?.tool_id) {
      await api.put(endpoints.connections.catalogItem(editingTool.tool_id), values);
    } else {
      await api.post(endpoints.connections.catalog(), values);
    }
    toast.success(`${values.name} saved.`);
    setEditingTool(null);
    await catalogQuery.reload();
  };

  const removeTool = async (tool) => {
    const ok = await confirm({
      title: 'Unlist tool',
      message: `Unlist “${tool.name}”? Businesses already connected keep their connection — the tool just stops being offered.`,
      confirmLabel: 'Unlist',
    });
    if (!ok) return;
    try {
      await api.del(endpoints.connections.catalogItem(tool.tool_id));
      toast.success('Tool unlisted.');
      await catalogQuery.reload();
    } catch (err) {
      toast.error(err);
    }
  };

  const connect = async (toolId) => {
    if (!connectFor) return;
    setBusy(toolId);
    try {
      const result = await api.post(endpoints.connections.connect(connectFor, toolId));
      if (result?.redirect_url) {
        toast.info('Opening the authorisation page in a new tab.', 'Connect');
        window.open(result.redirect_url, '_blank', 'noopener');
      } else if (result?.status === 'connected') {
        toast.success('Connected.');
      } else {
        toast.warning('Composio accepted the request but returned no authorisation URL.');
      }
      await connectionsQuery.reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  };

  const refresh = async (row) => {
    setBusy(row.tool_id);
    try {
      await api.post(endpoints.connections.refresh(row.entity_slug, row.tool_id));
      toast.success('Status refreshed.');
      await connectionsQuery.reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (row) => {
    const ok = await confirm({
      title: 'Disconnect',
      message: `Disconnect ${row.tool_name} from ${row.entity_name || row.entity_slug}?`,
      confirmLabel: 'Disconnect',
    });
    if (!ok) return;
    try {
      await api.del(endpoints.connections.disconnect(row.entity_slug, row.tool_id));
      toast.success('Disconnected.');
      await connectionsQuery.reload();
    } catch (err) {
      toast.error(err);
    }
  };

  const connected = connections.filter((c) => c.status === 'connected').length;
  const pending = connections.filter((c) => c.status === 'pending').length;

  return (
    <>
      <PageHeader
        title="Connections"
        description="Third-party accounts a business can connect through Composio."
        actions={
          <>
            <Button
              onClick={() => {
                statusQuery.reload();
                catalogQuery.reload();
                connectionsQuery.reload();
              }}
            >
              Refresh
            </Button>
            {tab === 'catalog' && (
              <Button variant="primary" onClick={() => setEditingTool({})}>Add tool</Button>
            )}
          </>
        }
      />

      {!statusQuery.loading && status.configured === false && (
        <>
          <Notice tone="warning" title="Composio is not configured on the server">
            <p>
              {status.reason || 'COMPOSIO_API_KEY is not set.'} The catalog and existing connection
              records work; starting a new connection will return 501 until the key is set and the
              API redeployed.
            </p>
          </Notice>
          <div style={{ height: 'var(--space-4)' }} />
        </>
      )}

      {!statusQuery.loading && status.configured && status.reachable === false && (
        <>
          <Notice tone="danger" title="Composio is configured but not reachable">
            {status.reason}
          </Notice>
          <div style={{ height: 'var(--space-4)' }} />
        </>
      )}

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="Tools offered" value={catalogQuery.loading ? '…' : tools.length} tone="primary" />
        <Stat label="Connected" value={connectionsQuery.loading ? '…' : connected} tone="success" />
        <Stat
          label="Awaiting authorisation"
          value={connectionsQuery.loading ? '…' : pending}
          tone={pending ? 'warning' : 'neutral'}
        />
        <Stat
          label="Composio"
          value={status.configured ? (status.reachable ? 'Ready' : 'Unreachable') : 'Not set up'}
          tone={status.configured && status.reachable ? 'success' : 'warning'}
        />
      </div>

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <TabBar
          tabs={TABS.map((item) => ({
            ...item,
            badge: item.id === 'catalog' ? tools.length : connections.length,
          }))}
          activeId={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'connections' && (
        <Card padded={false}>
          <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
            {connectionsQuery.error && (
              <ErrorState error={connectionsQuery.error} onRetry={connectionsQuery.reload} />
            )}
            <DataTable
              columns={[
                {
                  key: 'tool_name',
                  header: 'Tool',
                  render: (row) => (
                    <span className="row" style={{ gap: 8 }}>
                      {row.tool_logo && (
                        <img src={row.tool_logo} alt="" width={20} height={20} style={{ borderRadius: 4 }} />
                      )}
                      <span className="ui-cell-primary">{row.tool_name}</span>
                    </span>
                  ),
                },
                {
                  key: 'entity_name',
                  header: 'Business',
                  value: (row) => row.entity_name || row.entity_slug,
                  render: (row) => row.entity_name || <span className="mono">{row.entity_slug}</span>,
                },
                columns.status('status', 'Status', STATUS_TONES),
                columns.dateTime('connected_at', 'Connected'),
                {
                  key: '__actions',
                  header: '',
                  align: 'right',
                  sortable: false,
                  searchable: false,
                  stopPropagation: true,
                  render: (row) => (
                    <span className="ui-cell-actions">
                      {row.status === 'pending' && (
                        <Button size="sm" loading={busy === row.tool_id} onClick={() => refresh(row)}>
                          Check
                        </Button>
                      )}
                      {row.status !== 'disconnected' && (
                        <Button size="sm" variant="danger" onClick={() => disconnect(row)}>
                          Disconnect
                        </Button>
                      )}
                    </span>
                  ),
                },
              ]}
              rows={connections}
              loading={connectionsQuery.loading}
              rowKey={(row, index) => row.id ?? index}
              searchPlaceholder="Search connections…"
              emptyTitle="No connections"
              emptyDescription="No business has connected a tool yet."
              toolbar={
                <>
                  <div style={{ minWidth: 220, flex: 1, maxWidth: 300 }}>
                    <EntityPicker
                      value={slug}
                      onChange={setSlug}
                      label={null}
                      placeholder="All businesses…"
                    />
                  </div>
                  <Button
                    variant="primary"
                    disabled={!slug}
                    onClick={() => setConnectFor(slug)}
                    title={slug ? undefined : 'Pick a business first'}
                  >
                    Connect a tool
                  </Button>
                </>
              }
            />
          </div>
        </Card>
      )}

      {tab === 'catalog' && (
        <Card padded={false}>
          <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
            {catalogQuery.loading && <LoadingBlock />}
            {catalogQuery.error && <ErrorState error={catalogQuery.error} onRetry={catalogQuery.reload} />}
            {!catalogQuery.loading && !catalogQuery.error && (
              <DataTable
                columns={[
                  {
                    key: 'name',
                    header: 'Tool',
                    render: (row) => (
                      <span className="row" style={{ gap: 8 }}>
                        {row.logo ? (
                          <img src={row.logo} alt="" width={22} height={22} style={{ borderRadius: 4 }} />
                        ) : (
                          <span aria-hidden="true">{row.icon || '🔌'}</span>
                        )}
                        <span>
                          <span className="ui-cell-primary">{row.name}</span>
                          <span className="ui-cell-sub mono">{row.tool_id}</span>
                        </span>
                      </span>
                    ),
                  },
                  columns.text('cat', 'Category'),
                  {
                    key: 'integration_id',
                    header: 'Composio',
                    render: (row) =>
                      row.integration_id ? (
                        <Badge tone="success">linked</Badge>
                      ) : (
                        <Badge tone="warning">no integration id</Badge>
                      ),
                  },
                  columns.number('sort_order', 'Order'),
                  columns.bool('is_active', 'Listed'),
                  {
                    key: '__actions',
                    header: '',
                    align: 'right',
                    sortable: false,
                    searchable: false,
                    stopPropagation: true,
                    render: (row) => (
                      <span className="ui-cell-actions">
                        <Button size="sm" onClick={() => setEditingTool(row)}>Edit</Button>
                        <Button size="sm" variant="danger" onClick={() => removeTool(row)}>Unlist</Button>
                      </span>
                    ),
                  },
                ]}
                rows={tools}
                rowKey="tool_id"
                searchPlaceholder="Search tools…"
                emptyTitle="No tools in the catalog"
                emptyDescription="Add the tools you want businesses to be able to connect."
                emptyAction={
                  <Button variant="primary" onClick={() => setEditingTool({})}>Add tool</Button>
                }
              />
            )}
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(editingTool)}
        onClose={() => setEditingTool(null)}
        size="lg"
        title={editingTool?.tool_id ? `Edit ${editingTool.name}` : 'Add a tool'}
      >
        {editingTool && (
          <SchemaForm
            schema={toolSchema}
            initialValues={{ is_active: true, provider: 'composio', ...editingTool }}
            onSubmit={saveTool}
            onCancel={() => setEditingTool(null)}
            submitLabel={editingTool.tool_id ? 'Save tool' : 'Add to catalog'}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(connectFor)}
        onClose={() => setConnectFor(null)}
        size="lg"
        title="Connect a tool"
        description={connectFor ? `Authorising on behalf of ${connectFor}.` : undefined}
      >
        {tools.length === 0 ? (
          <EmptyState
            icon="🔌"
            title="No tools to connect"
            description="Add tools to the catalog first."
          />
        ) : (
          <ul className="sec-editor__items">
            {tools
              .filter((t) => t.is_active !== false)
              .map((tool) => {
                const already = connections.find(
                  (c) => c.tool_id === tool.tool_id && c.entity_slug === connectFor,
                );
                return (
                  <li className="sec-editor__item" key={tool.tool_id}>
                    <div className="sec-editor__itembody">
                      <div className="sec-editor__itemname">
                        {tool.name}
                        {already && (
                          <Badge tone={STATUS_TONES[already.status] || 'neutral'}>
                            {already.status}
                          </Badge>
                        )}
                        {!tool.integration_id && <Badge tone="warning">no integration id</Badge>}
                      </div>
                      <div className="sec-editor__itemdesc">{tool.description}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      loading={busy === tool.tool_id}
                      disabled={!tool.integration_id || already?.status === 'connected'}
                      onClick={() => connect(tool.tool_id)}
                    >
                      {already?.status === 'connected' ? 'Connected' : 'Connect'}
                    </Button>
                  </li>
                );
              })}
          </ul>
        )}
      </Modal>

      {confirmElement}
    </>
  );
}
