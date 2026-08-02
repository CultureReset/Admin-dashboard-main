/**
 * Referral partners — people distributing QR codes, and what they earned.
 *
 * GET/POST /api/qr/partners, PUT /api/qr/partners/:id
 * GET /api/qr/partners/:id/stats
 * GET /api/qr/partner-portal/:code  the partner's own view
 */

import { useState } from 'react';
import { Button, ErrorState, LoadingBlock, Stat } from '../../ui/primitives.jsx';
import { CrudSection } from '../../ui/CrudSection.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { qrPartnersResource } from '../../api/resources.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, fields, formatMoney, formatNumber } from '../../lib/fields.jsx';

const schema = {
  groups: [
    {
      title: 'Partner',
      fields: [
        fields.text('name', 'Name', { required: true, span: 2 }),
        fields.email('email', 'Email'),
        fields.tel('phone', 'Phone'),
        fields.text('company', 'Company'),
      ],
    },
    {
      title: 'Commercials',
      fields: [
        fields.number('commission_rate', 'Commission rate (%)', { min: 0, max: 100, step: 0.1 }),
        fields.money('commission_per_scan', 'Per-scan payout'),
        fields.bool('is_active', 'Active', { defaultValue: true }),
      ],
    },
    {
      title: 'Notes',
      fields: [fields.textarea('notes', 'Notes', { rows: 3 })],
    },
  ],
};

export default function ReferralPartners() {
  const [statsFor, setStatsFor] = useState(null);

  return (
    <>
      <CrudSection
        title="Referral partners"
        description="Who distributes QR codes on your behalf, and what they are owed."
        resource={qrPartnersResource}
        labelFor={(row) => row.name}
        createLabel="Add partner"
        modalSize="lg"
        emptyTitle="No partners"
        emptyDescription="Add a partner to start tracking referrals."
        searchPlaceholder="Search partners…"
        columns={[
          columns.primary('name', 'Partner', 'company'),
          columns.text('email', 'Email'),
          columns.text('phone', 'Phone'),
          {
            key: 'commission_rate',
            header: 'Commission',
            align: 'right',
            render: (row) =>
              row.commission_rate != null ? (
                `${row.commission_rate}%`
              ) : row.commission_per_scan != null ? (
                `${formatMoney(row.commission_per_scan)}/scan`
              ) : (
                <span className="faint">—</span>
              ),
          },
          columns.number('scan_count', 'Scans'),
          columns.bool('is_active', 'Active'),
          {
            key: '__stats',
            header: '',
            align: 'right',
            sortable: false,
            searchable: false,
            stopPropagation: true,
            render: (row) => (
              <Button size="sm" onClick={() => setStatsFor(row)}>Stats</Button>
            ),
          },
        ]}
        formSchema={schema}
      />

      <Modal
        open={Boolean(statsFor)}
        onClose={() => setStatsFor(null)}
        size="lg"
        title={statsFor ? `Performance — ${statsFor.name}` : ''}
      >
        {statsFor && <PartnerStats partnerId={statsFor.id} />}
      </Modal>
    </>
  );
}

function PartnerStats({ partnerId }) {
  const { data, loading, error, reload } = useAsync(
    async () => api.get(endpoints.qr.partnerStats(partnerId)),
    [partnerId],
    { initialData: null },
  );

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <p className="muted">No statistics available.</p>;

  return (
    <div className="grid-auto">
      {Object.entries(data)
        .filter(([, value]) => typeof value !== 'object')
        .map(([key, value]) => (
          <Stat
            key={key}
            label={key.replace(/_/g, ' ')}
            value={
              /amount|payout|earned|commission|revenue/.test(key)
                ? formatMoney(value)
                : typeof value === 'number'
                  ? formatNumber(value)
                  : String(value)
            }
          />
        ))}
    </div>
  );
}
