/**
 * Coupons.
 *
 * GET/POST /api/admin/gcr/coupons, DELETE /api/admin/gcr/coupons/:id
 *
 * The API has no update route for coupons — only create and delete — so this
 * screen offers exactly those. Editing is deliberately absent rather than
 * shown as a button that would fail.
 */

import { CrudSection } from '../../ui/CrudSection.jsx';
import { couponsResource } from '../../api/resources.js';
import { columns, fields } from '../../lib/fields.jsx';

const couponSchema = [
  fields.text('code', 'Code', {
    required: true,
    span: 2,
    help: 'What the customer types. Usually uppercase.',
    transform: (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
  }),
  fields.select('type', 'Type', [
    { value: 'percent', label: 'Percent off' },
    { value: 'amount', label: 'Amount off' },
  ], { required: true }),
  fields.number('amount', 'Amount', { required: true, min: 0, step: '0.01' }),
  fields.number('max_uses', 'Max uses', { min: 0, step: 1, help: 'Leave blank for unlimited.' }),
  fields.date('expires_at', 'Expires'),
  fields.textarea('description', 'Description', { rows: 2 }),
];

export default function Coupons() {
  return (
    <CrudSection
      title="Coupons"
      description="Discount codes. The API supports creating and deleting coupons; there is no update route, so editing is not offered."
      resource={couponsResource}
      labelFor={(row) => row.code}
      createLabel="Create coupon"
      canEdit={false}
      emptyTitle="No coupons"
      searchPlaceholder="Search codes…"
      columns={[
        {
          key: 'code',
          header: 'Code',
          render: (row) => <span className="mono ui-cell-primary">{row.code}</span>,
        },
        columns.text('type', 'Type'),
        {
          key: 'amount',
          header: 'Value',
          align: 'right',
          render: (row) =>
            row.type === 'percent' ? `${row.amount}%` : `$${Number(row.amount ?? 0).toFixed(2)}`,
        },
        columns.number('max_uses', 'Max uses'),
        columns.number('times_used', 'Used'),
        columns.date('expires_at', 'Expires'),
        columns.text('description', 'Description'),
      ]}
      formSchema={couponSchema}
    />
  );
}
