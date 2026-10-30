/**
 * Business leads.
 *
 * Backed by the same `leads` table as Platform → Leads (/api/admin/sales-leads).
 * The path /api/admin/business-leads is kept so this screen and the legacy
 * dashboard share one route; gcr-api-clean repoints it rather than inventing
 * a second leads feature.
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
        description="Inbound interest from the public sign-up form and sales pipeline."
      />

      <Notice tone="info" title="Same data as Platform → Leads">
        This screen reads <code className="mono">/api/admin/business-leads</code>, which is the{' '}
        <code className="mono">leads</code> table — the same rows as{' '}
        <Link to="/platform/leads">Platform → Leads</Link>. TripSwipe swipe/save counts are not on
        that table, so those columns stay empty when absent.
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <CrudSection
        title="Leads"
        resource={businessLeadsResource}
        labelFor={(row) => row.business_name || row.entity_slug || row.name}
        canCreate={false}
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
