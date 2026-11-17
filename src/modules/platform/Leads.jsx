/**
 * Sales leads.
 *
 * GET   /api/admin/sales-leads
 * PATCH /api/admin/sales-leads/:id
 *
 * The PATCH writes the body straight to `leads`, so the form only carries
 * real columns of that table (it has no owner or follow-up date).
 */

import { CrudSection } from '../../ui/CrudSection.jsx';
import { salesLeadsResource } from '../../api/resources.js';
import { columns, fields } from '../../lib/fields.jsx';

const LEAD_STATUSES = ['new', 'contacted', 'demo', 'proposal', 'won', 'lost'];

const schema = {
  groups: [
    {
      title: 'Pipeline',
      fields: [
        fields.select('status', 'Status', LEAD_STATUSES, { required: true }),
        fields.text('plan', 'Plan'),
      ],
    },
    {
      title: 'Notes',
      fields: [fields.textarea('notes', 'Notes', { rows: 5 })],
    },
  ],
};

export default function Leads() {
  return (
    <CrudSection
      title="Leads"
      description="Prospective businesses. The API supports updating a lead's status and notes."
      resource={salesLeadsResource}
      labelFor={(row) => row.business_name || row.name || row.email}
      canCreate={false}
      canDelete={false}
      modalSize="md"
      emptyTitle="No leads"
      emptyDescription="Nothing in the pipeline yet."
      searchPlaceholder="Search leads…"
      columns={[
        columns.primary('business_name', 'Business', 'category'),
        columns.text('name', 'Contact'),
        columns.text('email', 'Email'),
        columns.text('phone', 'Phone'),
        columns.status('status', 'Status', {
          new: 'info',
          contacted: 'warning',
          demo: 'primary',
          proposal: 'primary',
          won: 'success',
          lost: 'danger',
        }),
        columns.text('plan', 'Plan'),
        columns.text('source', 'Source'),
        columns.dateTime('created_at', 'Created'),
      ]}
      formSchema={schema}
      initialSort={{ key: 'created_at', direction: 'desc' }}
    />
  );
}
