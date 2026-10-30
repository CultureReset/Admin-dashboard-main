/**
 * Business leads surfaced by Trip Swipe activity.
 *
 * /api/admin/business-leads is called by the legacy dashboard but is not in
 * gcr-api-clean. The screen is wired to it and reports the gap.
 *
 * The sales pipeline that does work is Platform → Leads
 * (/api/admin/sales-leads).
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

      <Notice tone="warning" title="This screen's API route is not deployed">
        <code className="mono">/api/admin/business-leads</code> is called by the previous dashboard
        but does not exist in <code>gcr-api-clean</code>. The working sales pipeline is{' '}
        <Link to="/platform/leads">Platform → Leads</Link>.
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      <CrudSection
        title="Leads"
        resource={businessLeadsResource}
        labelFor={(row) => row.business_name || row.entity_slug}
        canCreate={false}
        emptyTitle="No business leads"
        searchPlaceholder="Search leads…"
        unavailableNotice="Nothing can load until the business-leads route exists on the API."
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
