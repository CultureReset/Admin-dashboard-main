/**
 * Customers collected across GCR.
 *
 * GET /api/admin/gcr/customers — read-only; the API exposes no write route.
 *
 * Rows are Trip Swipe tourist profiles (phone-based, so email is always
 * null) with a derived status: lead, customer or vip.
 */

import { ListSection } from '../../ui/CrudSection.jsx';
import { customersResource } from '../../api/resources.js';
import { columns } from '../../lib/fields.jsx';

const STATUS_TONES = { lead: 'info', customer: 'neutral', vip: 'success' };

export default function Customers() {
  return (
    <ListSection
      title="Customers"
      description="Trip Swipe visitors, by how far they got: lead (onboarding not finished), customer, or VIP (trip set up and opted into SMS). Read-only."
      resource={customersResource}
      searchPlaceholder="Search by name or phone…"
      emptyTitle="No customers"
      columns={[
        columns.primary('name', 'Name', 'phone'),
        columns.status('status', 'Status', STATUS_TONES),
        columns.text('destination', 'Destination'),
        columns.bool('sms_opt_in', 'SMS opt-in'),
        columns.dateTime('last_active', 'Last active'),
        columns.dateTime('created_at', 'First seen'),
      ]}
      initialSort={{ key: 'created_at', direction: 'desc' }}
    />
  );
}
