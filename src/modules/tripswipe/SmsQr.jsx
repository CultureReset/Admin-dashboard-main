/**
 * Text sign-up QR codes.
 *
 * GET/POST /api/sms/qr-codes
 * DELETE   /api/sms/qr-codes/:id
 * GET      /api/sms/qr-codes/:id/scans
 */

import { useState } from 'react';
import { Button, EmptyState, ErrorState, LoadingBlock } from '../../ui/primitives.jsx';
import { CrudSection } from '../../ui/CrudSection.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { smsQrResource } from '../../api/resources.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, fields } from '../../lib/fields.jsx';

const schema = [
  fields.text('label', 'Label', {
    required: true,
    span: 2,
    help: 'Where this code will be placed — “Front desk”, “Table tent”.',
  }),
];
// POST /api/sms/qr-codes takes only a label; the API generates the keyword
// and answers each row with its scan count and the sms: link to encode.

export default function SmsQr() {
  const [scansFor, setScansFor] = useState(null);

  return (
    <>
      <CrudSection
        title="Text sign-up QR codes"
        description="Printed codes that start an SMS sign-up conversation."
        resource={smsQrResource}
        labelFor={(row) => row.label || row.keyword}
        createLabel="Create QR code"
        emptyTitle="No QR codes"
        emptyDescription="Create one, print it, and track the scans."
        searchPlaceholder="Search codes…"
        canEdit={false}
        columns={[
          columns.primary('label', 'Label', 'keyword'),
          columns.text('sms_body', 'Visitor texts'),
          columns.link('sms_link', 'QR target', { label: 'sms: link' }),
          columns.number('scans', 'Scans'),
          columns.dateTime('created_at', 'Created'),
          {
            key: '__scans',
            header: '',
            align: 'right',
            sortable: false,
            searchable: false,
            stopPropagation: true,
            render: (row) => (
              <Button size="sm" onClick={() => setScansFor(row)}>View scans</Button>
            ),
          },
        ]}
        formSchema={schema}
      />

      <Modal
        open={Boolean(scansFor)}
        onClose={() => setScansFor(null)}
        size="lg"
        title={scansFor ? `Scans — ${scansFor.label || scansFor.keyword}` : ''}
      >
        {scansFor && <ScanList qrId={scansFor.id} />}
      </Modal>
    </>
  );
}

function ScanList({ qrId }) {
  const { data, loading, error, reload } = useAsync(
    async () => unwrapList(await api.get(endpoints.sms.qrCodeScans(qrId)), ['scans']),
    [qrId],
    { initialData: [] },
  );

  const scans = data || [];

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (scans.length === 0) {
    return <EmptyState icon="🔳" title="No scans" description="This code has not been scanned yet." />;
  }

  return (
    <DataTable
      columns={[
        columns.dateTime('created_at', 'When'),
        columns.text('phone', 'Phone'),
        columns.text('name', 'Name'),
      ]}
      rows={scans}
      rowKey={(row, index) => row.id ?? index}
      dense
      initialSort={{ key: 'created_at', direction: 'desc' }}
    />
  );
}
