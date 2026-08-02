/**
 * Customers collected across GCR.
 *
 * GET /api/admin/gcr/customers — read-only; the API exposes no write route.
 */

import { ListSection } from '../../ui/CrudSection.jsx';
import { customersResource } from '../../api/resources.js';
import { columns } from '../../lib/fields.jsx';

export default function Customers() {
  return (
    <ListSection
      title="Customers"
      description="People captured through bookings, sign-ups, and SMS opt-ins. Read-only — the API has no customer write route."
      resource={customersResource}
      searchPlaceholder="Search by name, email, or phone…"
      emptyTitle="No customers"
      columns={[
        columns.primary('name', 'Name', 'email'),
        columns.text('email', 'Email'),
        columns.text('phone', 'Phone'),
        columns.text('entity_slug', 'Business'),
        columns.text('source', 'Source'),
        columns.dateTime('created_at', 'First seen'),
      ]}
      initialSort={{ key: 'created_at', direction: 'desc' }}
    />
  );
}
