/**
 * Promo codes for the booking engine.
 *
 * Distinct from Content → Coupons, which is the GCR directory's own
 * `/api/admin/gcr/coupons`. These are `promos` rows redeemed at booking time.
 *
 * GET/POST /api/admin/platform/promos
 * PUT/DELETE /api/admin/platform/promos/:id
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Notice } from '../../ui/primitives.jsx';
import { CrudSection } from '../../ui/CrudSection.jsx';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import { promosResource } from '../../api/bookingResources.js';
import { columns, fields, formatMoney } from '../../lib/fields.jsx';

const promoSchema = {
  groups: [
    {
      title: 'Code',
      fields: [
        fields.text('code', 'Code', {
          required: true,
          span: 2,
          help: 'Stored uppercase. What the guest types at checkout.',
          transform: (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
        }),
        fields.select('type', 'Discount type', [
          { value: 'percent', label: 'Percent off' },
          { value: 'amount', label: 'Amount off' },
        ], { required: true }),
        fields.number('amount', 'Value', { required: true, min: 0, step: '0.01' }),
      ],
    },
    {
      title: 'Limits',
      fields: [
        fields.date('starts', 'Valid from'),
        fields.date('ends', 'Valid until'),
        // No max_uses field: the API forwards it, but the live `promos` table
        // has no max_uses / used columns, so sending it fails the whole save.
        fields.bool('active', 'Active', { defaultValue: true }),
      ],
    },
  ],
};

export default function Promos() {
  const [slug, setSlug] = useState(null);
  const query = useMemo(() => ({ slug: slug || undefined, limit: 500 }), [slug]);

  return (
    <>
      <Notice tone="info" title="These are booking promos">
        Redeemed against a booking. The GCR directory's own discount codes live in{' '}
        <Link to="/content/coupons">Content → Coupons</Link> and are a different table.
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <CrudSection
        title="Booking promos"
        description="Discount codes applied when a guest books."
        resource={promosResource}
        query={query}
        labelFor={(row) => row.code}
        createLabel="Create promo"
        emptyTitle="No promos"
        emptyDescription={slug ? 'This business has no promo codes.' : 'No promo codes on any business.'}
        searchPlaceholder="Search codes…"
        modalSize="md"
        headerActions={
          <div style={{ minWidth: 220, maxWidth: 300 }}>
            <EntityPicker value={slug} onChange={setSlug} label={null} placeholder="All businesses…" />
          </div>
        }
        // A promo must belong to a business; the picker above supplies it.
        fromFormValues={(values, editing) => ({
          ...values,
          entity_slug: editing?.entity_slug || slug || undefined,
        })}
        columns={[
          {
            key: 'code',
            header: 'Code',
            render: (row) => <span className="mono ui-cell-primary">{row.code}</span>,
          },
          {
            key: 'entity_name',
            header: 'Business',
            value: (row) => row.entity_name || row.entity_slug,
            render: (row) => row.entity_name || <span className="mono">{row.entity_slug}</span>,
          },
          {
            key: 'amount',
            header: 'Discount',
            align: 'right',
            render: (row) =>
              row.type === 'percent' ? `${row.amount}%` : formatMoney(row.amount) || '—',
          },
          columns.date('starts', 'From'),
          columns.date('ends', 'Until'),
          columns.bool('active', 'Active'),
        ]}
        formSchema={promoSchema}
      />
    </>
  );
}
