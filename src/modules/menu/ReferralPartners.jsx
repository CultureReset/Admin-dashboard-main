/**
 * Referral partners — people distributing QR codes, and what they earned.
 *
 * GET/POST /api/qr/partners, PUT /api/qr/partners/:id
 * GET /api/qr/partners/:id/stats
 * GET /api/qr/partner-portal/:code  the partner's own view
 *
 * Fields mirror `referral_partners` as the API writes it: POST takes name,
 * email, phone, type, referral_rate (a fraction — 0.05 is 5%) and
 * incentive_text; PUT additionally takes total_paid. There is no DELETE route,
 * so partners cannot be removed from here.
 */

import { useState } from 'react';
import { Button, ErrorState, LoadingBlock, Stat } from '../../ui/primitives.jsx';
import { CrudSection } from '../../ui/CrudSection.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
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
        fields.text('type', 'Type', { placeholder: 'rental', help: 'Defaults to rental when left blank.', omitWhenEmpty: true }),
      ],
    },
    {
      title: 'Commercials',
      fields: [
        fields.number('referral_rate', 'Referral rate', {
          min: 0,
          max: 1,
          step: 0.01,
          defaultValue: 0.05,
          help: 'A fraction of each booking: 0.05 is 5%.',
        }),
        fields.money('total_paid', 'Paid out to date'),
        fields.textarea('incentive_text', 'Offer shown to guests', {
          rows: 2,
          placeholder: 'Welcome to the Gulf Coast! Get $10 off your first activity booking.',
        }),
      ],
    },
  ],
};

const percent = (value) => (value == null || value === '' ? null : `${Math.round(Number(value) * 1000) / 10}%`);

export default function ReferralPartners() {
  const [statsFor, setStatsFor] = useState(null);

  return (
    <>
      <CrudSection
        title="Referral partners"
        description="Who distributes QR codes on your behalf, and what they are owed."
        resource={qrPartnersResource}
        labelFor={(row) => row.name}
        canDelete={false}
        createLabel="Add partner"
        modalSize="lg"
        emptyTitle="No partners"
        emptyDescription="Add a partner to start tracking referrals."
        searchPlaceholder="Search partners…"
        columns={[
          columns.primary('name', 'Partner', 'qr_code'),
          columns.text('type', 'Type'),
          columns.text('email', 'Email'),
          columns.text('phone', 'Phone'),
          {
            key: 'referral_rate',
            header: 'Rate',
            align: 'right',
            render: (row) => percent(row.referral_rate) || <span className="faint">—</span>,
          },
          columns.number('total_signups', 'Sign-ups'),
          columns.money('total_paid', 'Paid'),
          columns.bool('active', 'Active'),
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

  // { partner, stats: { total_signups, total_bookings, total_earned,
  //   last_30_days: { signups, bookings, earned } }, recent_events: [...] }
  const stats = data?.stats || {};
  const recent = stats.last_30_days || {};
  const events = Array.isArray(data?.recent_events) ? data.recent_events : [];

  return (
    <div className="stack">
      <div className="grid-auto">
        <Stat label="Sign-ups" value={formatNumber(stats.total_signups)} />
        <Stat label="Bookings" value={formatNumber(stats.total_bookings)} />
        <Stat label="Earned" value={formatMoney(stats.total_earned) || '—'} />
        <Stat label="Sign-ups, 30 days" value={formatNumber(recent.signups)} />
        <Stat label="Bookings, 30 days" value={formatNumber(recent.bookings)} />
        <Stat label="Earned, 30 days" value={formatMoney(recent.earned) || '—'} />
      </div>
      {events.length > 0 ? (
        <DataTable
          columns={[
            columns.dateTime('created_at', 'When'),
            columns.text('event_type', 'Event'),
            columns.money('commission', 'Commission'),
          ]}
          rows={events}
          rowKey={(row, index) => row.id ?? index}
          dense
          pageSize={10}
        />
      ) : (
        <p className="muted">No referral activity yet.</p>
      )}
    </div>
  );
}
