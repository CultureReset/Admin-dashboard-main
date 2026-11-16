/**
 * QR code inventory and scan tracking.
 *
 * GET/POST /api/qr, PATCH/DELETE /api/qr/:id
 * GET /api/qr/:id/scans, GET /api/qr/stats/summary
 * GET/POST /api/qr/locations, DELETE /api/qr/locations/:id
 *
 * Field names follow the `qr_codes` row the API reads and writes:
 * `destination_url` and `active` (POST takes label, destination_url, type,
 * location, notes; PATCH also takes active). `stats/summary` is a list of
 * codes with their scan counts, not a totals object, so totals are summed here.
 */

import { useState } from 'react';
import { Button, EmptyState, ErrorState, LoadingBlock, PageHeader, Stat } from '../../ui/primitives.jsx';
import { CrudSection } from '../../ui/CrudSection.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { TabBar } from '../../ui/Tabs.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { qrCodesResource, qrLocationsResource } from '../../api/resources.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, fields, formatNumber } from '../../lib/fields.jsx';

const qrSchema = {
  groups: [
    {
      title: 'Code',
      fields: [
        fields.text('label', 'Label', { required: true, span: 2 }),
        fields.url('destination_url', 'Destination URL', {
          span: 2,
          help: 'Where a scan lands. Leave blank to send scans to the default site.',
        }),
        fields.text('location', 'Placement', { placeholder: 'e.g. Table 4, front window' }),
        fields.text('type', 'Type', { placeholder: 'general' }),
      ],
    },
    {
      title: 'Status',
      fields: [
        fields.bool('active', 'Active', { defaultValue: true }),
        fields.textarea('notes', 'Notes', { rows: 3 }),
      ],
    },
  ],
};

const locationSchema = [
  fields.number('id', 'Location ID', {
    required: true,
    min: 1,
    max: 9999,
    step: 1,
    help: 'The number printed on the sticker (1–9999). Saving an existing ID renames it.',
  }),
  fields.text('name', 'Location name', { required: true }),
  fields.textarea('notes', 'Notes', { rows: 3 }),
];

/** `stats/summary` returns one row per code; older builds returned totals. */
function summarize(payload) {
  if (Array.isArray(payload)) {
    return {
      codes: payload.length,
      active_codes: payload.filter((row) => row.active).length,
      total_scans: payload.reduce((sum, row) => sum + (Number(row.scan_count) || 0), 0),
      never_scanned: payload.filter((row) => !Number(row.scan_count)).length,
    };
  }
  return payload && typeof payload === 'object' ? payload : {};
}

const TABS = [
  { id: 'codes', label: 'QR codes' },
  { id: 'locations', label: 'Locations' },
];

export default function QrTracker() {
  const [tab, setTab] = useState('codes');
  const [scansFor, setScansFor] = useState(null);

  const summaryQuery = useAsync(
    async () => api.get(endpoints.qr.statsSummary()),
    [],
    { initialData: null },
  );

  const summary = summarize(summaryQuery.data);

  return (
    <>
      <PageHeader
        title="QR tracker"
        description="Printed codes, where they are placed, and how often they get scanned."
        actions={<Button onClick={summaryQuery.reload}>Refresh stats</Button>}
      />

      {summaryQuery.error && !summaryQuery.error.isMissingEndpoint && (
        <>
          <ErrorState error={summaryQuery.error} onRetry={summaryQuery.reload} />
          <div style={{ height: 'var(--space-4)' }} />
        </>
      )}

      {!summaryQuery.loading && !summaryQuery.error && (
        <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
          {Object.entries(summary)
            .filter(([, value]) => typeof value !== 'object')
            .map(([key, value]) => (
              <Stat
                key={key}
                label={key.replace(/_/g, ' ')}
                value={typeof value === 'number' ? formatNumber(value) : String(value)}
              />
            ))}
        </div>
      )}

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <TabBar tabs={TABS} activeId={tab} onChange={setTab} />
      </div>

      {tab === 'codes' && (
        <CrudSection
          title="QR codes"
          resource={qrCodesResource}
          labelFor={(row) => row.label || row.code}
          createLabel="Create QR code"
          modalSize="lg"
          emptyTitle="No QR codes"
          emptyDescription="Create a code, print it, and watch the scans arrive."
          searchPlaceholder="Search codes…"
          columns={[
            columns.primary('label', 'Label', 'code'),
            columns.number('seq_number', '#'),
            columns.text('location', 'Placement'),
            columns.text('type', 'Type'),
            columns.link('destination_url', 'Destination', { label: 'Open' }),
            columns.number('scan_count', 'Scans'),
            columns.bool('active', 'Active'),
            {
              key: '__scans',
              header: '',
              align: 'right',
              sortable: false,
              searchable: false,
              stopPropagation: true,
              render: (row) => (
                <Button size="sm" onClick={() => setScansFor(row)}>Scans</Button>
              ),
            },
          ]}
          formSchema={qrSchema}
        />
      )}

      {tab === 'locations' && (
        <CrudSection
          title="Locations"
          description="Where codes are physically placed."
          resource={qrLocationsResource}
          labelFor={(row) => row.name}
          createLabel="Add location"
          emptyTitle="No locations"
          searchPlaceholder="Search locations…"
          columns={[
            columns.number('id', 'ID'),
            columns.primary('name', 'Location'),
            columns.text('notes', 'Notes'),
          ]}
          initialSort={{ key: 'id', direction: 'asc' }}
          formSchema={locationSchema}
        />
      )}

      <Modal
        open={Boolean(scansFor)}
        onClose={() => setScansFor(null)}
        size="lg"
        title={scansFor ? `Scans — ${scansFor.label || scansFor.code}` : ''}
      >
        {scansFor && <ScanLog qrId={scansFor.id} />}
      </Modal>
    </>
  );
}

function ScanLog({ qrId }) {
  const { data, loading, error, reload } = useAsync(
    async () => unwrapList(await api.get(endpoints.qr.scans(qrId)), ['scans']),
    [qrId],
    { initialData: [] },
  );

  const scans = data || [];

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (scans.length === 0) {
    return <EmptyState icon="🔳" title="No scans" description="This code has not been scanned." />;
  }

  return (
    <DataTable
      columns={[
        columns.dateTime('scanned_at', 'When'),
        columns.text('device_type', 'Device'),
        columns.text('user_agent', 'Browser'),
      ]}
      rows={scans}
      rowKey={(row, index) => row.id ?? index}
      dense
      initialSort={{ key: 'scanned_at', direction: 'desc' }}
    />
  );
}
