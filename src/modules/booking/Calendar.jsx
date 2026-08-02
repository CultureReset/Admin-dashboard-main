/**
 * Booking calendar — every date claim, whatever made it.
 *
 * `booking_calendar` is the single table availability is computed from:
 * direct bookings, manual blocks, Airbnb, FareHarbor, iCal, email parsers.
 * Seeing them side by side is how you find out why a date looks unavailable.
 *
 * GET/POST /api/admin/platform/calendar
 * DELETE /api/admin/platform/calendar/:id
 */

import { useMemo, useState } from 'react';
import { Badge, Button, Card, PageHeader, Stat } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { Modal, useConfirm } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { fields, formatDate } from '../../lib/fields.jsx';

/** Tone by where the claim came from, so imports read differently to blocks. */
const SOURCE_TONES = {
  direct: 'success',
  'manual block': 'warning',
  manual: 'warning',
  fareharbor: 'info',
  airbnb: 'info',
  ical: 'info',
};

const blockSchema = {
  groups: [
    {
      title: 'Block out dates',
      fields: [
        fields.date('date', 'From', { required: true }),
        fields.date('end_date', 'To', { help: 'Leave blank to block a single day.' }),
        fields.text('note', 'Reason', {
          span: 'full',
          placeholder: 'Maintenance, private hire, owner use…',
        }),
      ],
    },
  ],
};

function defaultRange() {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 60);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function Calendar() {
  const toast = useToast();
  const [slug, setSlug] = useState(null);
  const [source, setSource] = useState('');
  const [range, setRange] = useState(defaultRange);
  const [blocking, setBlocking] = useState(false);
  const [confirm, confirmElement] = useConfirm();

  const query = useMemo(
    () => ({
      slug: slug || undefined,
      source: source || undefined,
      from: range.from || undefined,
      to: range.to || undefined,
      limit: 1000,
    }),
    [slug, source, range.from, range.to],
  );

  const { data, loading, error, reload } = useAsync(
    async () => unwrapList(await api.get(endpoints.bookingPlatform.calendar(), { query }), ['entries']),
    [query],
    { initialData: [] },
  );

  const entries = data || [];

  const sources = useMemo(() => {
    const seen = new Set();
    for (const e of entries) if (e.source) seen.add(e.source);
    return [...seen].sort();
  }, [entries]);

  const stats = useMemo(() => {
    const byDate = new Set(entries.map((e) => e.date));
    const blocks = entries.filter((e) => /block/i.test(e.source || '')).length;
    const imported = entries.filter((e) =>
      ['fareharbor', 'airbnb', 'ical'].includes(String(e.source || '').toLowerCase()),
    ).length;
    return { entries: entries.length, days: byDate.size, blocks, imported };
  }, [entries]);

  const addBlock = async (values) => {
    if (!slug) {
      toast.warning('Pick a business before blocking dates.');
      return;
    }
    await api.post(endpoints.bookingPlatform.calendar(), {
      ...values,
      entity_slug: slug,
      source: 'manual block',
    });
    toast.success('Dates blocked.');
    setBlocking(false);
    await reload();
  };

  const remove = async (row) => {
    const ok = await confirm({
      title: 'Remove calendar entry',
      message: `Remove the ${row.source || 'entry'} on ${formatDate(row.date)}? If it came from a booking, the booking itself is not deleted.`,
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    try {
      await api.del(endpoints.bookingPlatform.calendarEntry(row.id));
      toast.success('Entry removed.', 'Removed');
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <>
      <PageHeader
        title="Booking calendar"
        description="Every date claim from every source. Availability is computed from this one table."
        actions={
          <>
            <Button onClick={reload} disabled={loading}>Refresh</Button>
            <Button variant="primary" disabled={!slug} onClick={() => setBlocking(true)}>
              Block dates
            </Button>
          </>
        }
      />

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat label="Entries" value={loading ? '…' : stats.entries} tone="primary" />
        <Stat label="Distinct days claimed" value={loading ? '…' : stats.days} />
        <Stat label="Manual blocks" value={loading ? '…' : stats.blocks} tone="warning" />
        <Stat label="Imported" value={loading ? '…' : stats.imported} tone="info" />
      </div>

      <Card padded={false}>
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <DataTable
            columns={[
              {
                key: 'date',
                header: 'Date',
                render: (row) => (
                  <div>
                    <div className="ui-cell-primary">{formatDate(row.date)}</div>
                    {row.end_date && row.end_date !== row.date && (
                      <div className="ui-cell-sub">→ {formatDate(row.end_date)}</div>
                    )}
                  </div>
                ),
              },
              {
                key: 'entity_name',
                header: 'Business',
                value: (row) => row.entity_name || row.entity_slug,
                render: (row) => row.entity_name || <span className="mono">{row.entity_slug}</span>,
              },
              {
                key: 'source',
                header: 'Source',
                render: (row) => (
                  <Badge tone={SOURCE_TONES[String(row.source || '').toLowerCase()] || 'neutral'}>
                    {row.source || 'unknown'}
                  </Badge>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (row.status ? <Badge>{row.status}</Badge> : <span className="faint">—</span>),
              },
              {
                key: 'note',
                header: 'Note',
                render: (row) => row.note || <span className="faint">—</span>,
              },
              {
                key: '__actions',
                header: '',
                align: 'right',
                sortable: false,
                searchable: false,
                stopPropagation: true,
                render: (row) => (
                  <Button size="sm" variant="danger" onClick={() => remove(row)}>Remove</Button>
                ),
              },
            ]}
            rows={entries}
            loading={loading}
            error={error}
            onRetry={reload}
            searchPlaceholder="Search notes and sources…"
            emptyTitle="Nothing on the calendar"
            emptyDescription="No date claims in this range."
            initialSort={{ key: 'date', direction: 'asc' }}
            toolbar={
              <>
                <div style={{ minWidth: 210, flex: 1, maxWidth: 290 }}>
                  <EntityPicker
                    value={slug}
                    onChange={setSlug}
                    label={null}
                    placeholder="All businesses…"
                  />
                </div>
                <select
                  className="ui-input ui-input--select"
                  style={{ width: 'auto' }}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="">Any source</option>
                  {sources.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <input
                  className="ui-input"
                  type="date"
                  style={{ width: 'auto' }}
                  value={range.from}
                  aria-label="From date"
                  onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                />
                <input
                  className="ui-input"
                  type="date"
                  style={{ width: 'auto' }}
                  value={range.to}
                  aria-label="To date"
                  onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                />
              </>
            }
          />
        </div>
      </Card>

      <Modal
        open={blocking}
        onClose={() => setBlocking(false)}
        title="Block dates"
        description="Creates a manual claim so the dates stop showing as available."
      >
        <SchemaForm
          schema={blockSchema}
          onSubmit={addBlock}
          onCancel={() => setBlocking(false)}
          submitLabel="Block these dates"
        />
      </Modal>

      {confirmElement}
    </>
  );
}
