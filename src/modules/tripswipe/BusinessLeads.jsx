/**
 * Business leads surfaced by Trip Swipe activity.
 *
 * GET   /api/admin/business-leads       → { leads: [...] }
 * PATCH /api/admin/business-leads/:id   status, notes
 *
 * Served by routes/admin-settings.js over the same `leads` table as
 * Platform → Leads (/api/admin/sales-leads). There is no DELETE route.
 */

import { Link } from 'react-router-dom';
import { PageHeader, Notice } from '../../ui/primitives.jsx';
import { CrudSection } from '../../ui/CrudSection.jsx';
import { businessLeadsResource } from '../../api/resources.js';
import { columns, fields } from '../../lib/fields.jsx';

const schema = [
  fields.select('status', 'Status', ['new', 'contacted', 'qualified', 'won', 'lost'], {
    span: 'full',
  }),
  fields.textarea('notes', 'Notes', { rows: 4 }),
];

export default function BusinessLeads() {
  return (
    <>
      <PageHeader
        title="Business leads"
        description="Listings getting enough Trip Swipe attention to be worth a sales call."
      />

      <Notice tone="info" title="Same records as Platform → Leads">
        These come from the shared <code>leads</code> table; the full sales pipeline is in{' '}
        <Link to="/platform/leads">Platform → Leads</Link>.
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <CrudSection
        title="Leads"
        resource={businessLeadsResource}
        labelFor={(row) => row.business_name || row.entity_slug}
        canCreate={false}
        canDelete={false}
        emptyTitle="No business leads"
        searchPlaceholder="Search leads…"
        columns={[
          columns.primary('business_name', 'Business', 'entity_slug'),
          columns.number('swipe_count', 'Swipes'),
          columns.number('save_count', 'Saves'),
          columns.status('status', 'Status', {
            new: 'info',
            contacted: 'warning',
            qualified: 'primary',
            won: 'success',
            lost: 'danger',
          }),
          columns.dateTime('created_at', 'First seen'),
        ]}
        formSchema={schema}
      />
    </>
  );
}
