/**
 * Trip Swipe tourists.
 *
 * GET    /api/admin/tourists
 * GET    /api/admin/tourists/:id            detail with saves and itinerary
 * GET    /api/admin/tourists/:id/preferences
 * POST   /api/admin/tourists/:id/recompute-preferences
 * DELETE /api/admin/tourists/:id
 * DELETE /api/admin/tourists/:id/saves/:saveId
 * DELETE /api/admin/tourists/:id/itinerary/:itinId
 */

import { useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Modal, useConfirm } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, formatDateTime } from '../../lib/fields.jsx';

export default function Tourists() {
  const toast = useToast();
  const [openId, setOpenId] = useState(null);
  const [confirm, confirmElement] = useConfirm();

  const { data, loading, error, reload } = useAsync(
    async () => unwrapList(await api.get(endpoints.tourists.list()), ['tourists']),
    [],
    { initialData: [] },
  );

  const tourists = data || [];

  const remove = async (row) => {
    const id = row.user_id || row.id;
    const ok = await confirm({
      title: 'Delete tourist',
      message: `Delete ${row.name || row.email || id} and all of their saves and itineraries?`,
      confirmLabel: 'Delete permanently',
    });
    if (!ok) return;
    try {
      await api.del(endpoints.tourists.remove(id));
      toast.success('Tourist deleted.', 'Deleted');
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <>
      <PageHeader
        title="Tourists"
        description="Trip Swipe accounts, what they saved, and where they are going."
        actions={<Button onClick={reload} disabled={loading}>Refresh</Button>}
      />

      <Card padded={false}>
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <DataTable
            columns={[
              columns.primary('name', 'Name', 'email'),
              columns.text('email', 'Email'),
              columns.text('phone', 'Phone'),
              columns.number('saves_count', 'Saves'),
              columns.number('points', 'Points'),
              columns.dateTime('created_at', 'Joined'),
              {
                key: '__actions',
                header: '',
                align: 'right',
                sortable: false,
                searchable: false,
                stopPropagation: true,
                render: (row) => (
                  <span className="ui-cell-actions">
                    <Button size="sm" onClick={() => setOpenId(row.user_id || row.id)}>
                      View
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => remove(row)}>
                      Delete
                    </Button>
                  </span>
                ),
              },
            ]}
            rows={tourists}
            loading={loading}
            error={error}
            onRetry={reload}
            rowKey={(row) => row.user_id || row.id}
            searchPlaceholder="Search tourists…"
            emptyTitle="No tourists"
            emptyDescription="Nobody has signed up for Trip Swipe yet."
            initialSort={{ key: 'created_at', direction: 'desc' }}
            onRowClick={(row) => setOpenId(row.user_id || row.id)}
          />
        </div>
      </Card>

      <Modal
        open={Boolean(openId)}
        onClose={() => setOpenId(null)}
        size="lg"
        title="Tourist detail"
      >
        {openId && <TouristDetail userId={openId} confirm={confirm} onChanged={reload} />}
      </Modal>

      {confirmElement}
    </>
  );
}

function TouristDetail({ userId, confirm, onChanged }) {
  const toast = useToast();
  const [recomputing, setRecomputing] = useState(false);

  const detailQuery = useAsync(
    async () => api.get(endpoints.tourists.detail(userId)),
    [userId],
    { initialData: null },
  );

  const prefsQuery = useAsync(
    async () => api.get(endpoints.tourists.preferences(userId)),
    [userId],
    { initialData: null },
  );

  const detail = detailQuery.data;
  const saves = detail?.saves || [];
  const itinerary = detail?.itinerary || [];

  const recompute = async () => {
    setRecomputing(true);
    try {
      await api.post(endpoints.tourists.recomputePreferences(userId));
      toast.success('Preferences recomputed.');
      await prefsQuery.reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setRecomputing(false);
    }
  };

  const removeSave = async (save) => {
    const ok = await confirm({ title: 'Remove save', message: 'Remove this saved place?' });
    if (!ok) return;
    try {
      await api.del(endpoints.tourists.removeSave(userId, save.id));
      toast.success('Save removed.', 'Removed');
      await detailQuery.reload();
      onChanged?.();
    } catch (err) {
      toast.error(err);
    }
  };

  const removeItinerary = async (item) => {
    const ok = await confirm({ title: 'Remove itinerary item', message: 'Remove this stop?' });
    if (!ok) return;
    try {
      await api.del(endpoints.tourists.removeItinerary(userId, item.id));
      toast.success('Itinerary item removed.', 'Removed');
      await detailQuery.reload();
    } catch (err) {
      toast.error(err);
    }
  };

  if (detailQuery.loading) return <LoadingBlock />;
  if (detailQuery.error) return <ErrorState error={detailQuery.error} onRetry={detailQuery.reload} />;

  return (
    <div className="stack">
      <div className="row-wrap">
        <strong>{detail?.name || detail?.email || userId}</strong>
        {detail?.email && <Badge tone="info">{detail.email}</Badge>}
        {detail?.points != null && <Badge tone="primary">{detail.points} points</Badge>}
        {detail?.created_at && <span className="faint">Joined {formatDateTime(detail.created_at)}</span>}
      </div>

      <Card
        title={`Saves (${saves.length})`}
        padded={saves.length === 0}
        actions={<Button size="sm" onClick={detailQuery.reload}>Reload</Button>}
      >
        {saves.length === 0 ? (
          <EmptyState icon="🔖" title="No saves" description="This tourist has not saved anything." />
        ) : (
          <ul className="sec-editor__items">
            {saves.map((save) => (
              <li className="sec-editor__item" key={save.id}>
                <div className="sec-editor__itembody">
                  <div className="sec-editor__itemname">
                    {save.entity_name || save.name || save.entity_slug}
                  </div>
                  <div className="sec-editor__itemdesc mono">
                    {[save.entity_slug, formatDateTime(save.created_at)].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <Button size="sm" variant="danger" onClick={() => removeSave(save)}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Itinerary (${itinerary.length})`} padded={itinerary.length === 0}>
        {itinerary.length === 0 ? (
          <EmptyState icon="🗺️" title="No itinerary" description="Nothing planned yet." />
        ) : (
          <ul className="sec-editor__items">
            {itinerary.map((item) => (
              <li className="sec-editor__item" key={item.id}>
                <div className="sec-editor__itembody">
                  <div className="sec-editor__itemname">
                    {item.entity_name || item.title || item.entity_slug}
                  </div>
                  <div className="sec-editor__itemdesc mono">
                    {[item.day, item.time_slot, item.entity_slug].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <Button size="sm" variant="danger" onClick={() => removeItinerary(item)}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Preferences"
        subtitle="Derived from swipe behaviour."
        actions={
          <Button size="sm" loading={recomputing} onClick={recompute}>
            Recompute
          </Button>
        }
      >
        {prefsQuery.loading && <LoadingBlock />}
        {prefsQuery.error && <ErrorState error={prefsQuery.error} onRetry={prefsQuery.reload} />}
        {!prefsQuery.loading && !prefsQuery.error && (
          <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0, overflowX: 'auto' }}>
            {JSON.stringify(prefsQuery.data, null, 2)}
          </pre>
        )}
      </Card>
    </div>
  );
}
