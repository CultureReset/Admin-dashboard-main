/**
 * QR code inventory and scan tracking.
 *
 * GET/POST /api/qr, PATCH/DELETE /api/qr/:id
 * GET /api/qr/:id/scans, GET /api/qr/stats/summary
 * GET/POST /api/qr/locations
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
        fields.url('target_url', 'Destination URL', { span: 2, required: true }),
        fields.text('entity_slug', 'Business slug'),
        fields.text('location', 'Placement'),
      ],
    },
    {
      title: 'Campaign',
      fields: [
        fields.text('campaign', 'Campaign'),
        fields.text('partner_id', 'Partner ID'),
        fields.bool('is_active', 'Active', { defaultValue: true }),
      ],
    },
  ],
};

const locationSchema = [
  fields.text('name', 'Location name', { required: true, span: 2 }),
  fields.text('address', 'Address', { span: 2 }),
  fields.text('city', 'City'),
  fields.text('contact', 'Contact'),
];

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

  const summary = summaryQuery.data || {};

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
            columns.text('location', 'Placement'),
            columns.text('campaign', 'Campaign'),
            columns.link('target_url', 'Destination', { label: 'Open' }),
            columns.number('scan_count', 'Scans'),
            columns.bool('is_active', 'Active'),
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
            columns.primary('name', 'Location', 'address'),
            columns.text('city', 'City'),
            columns.text('contact', 'Contact'),
            columns.number('qr_count', 'Codes'),
          ]}
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
        columns.dateTime('created_at', 'When'),
        columns.text('city', 'City'),
        columns.text('referrer', 'Referrer'),
        columns.text('user_agent', 'Device'),
      ]}
      rows={scans}
      rowKey={(row, index) => row.id ?? index}
      dense
      initialSort={{ key: 'created_at', direction: 'desc' }}
    />
  );
}
