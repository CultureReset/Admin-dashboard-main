/**
 * App catalogue.
 *
 * GET/POST /api/admin/apps
 * PUT/DELETE /api/admin/apps/:appId
 *
 * These routes read and write the `apps` table. There is a second, separate
 * catalogue — `platform_apps`, seeded from the JSON manifests in
 * cybercheck-login/apps/ — which the owner-facing dashboard's store reads.
 * The two are not the same table and do not sync. Which one should be
 * canonical is an open decision; see docs/ENDPOINT-STATUS.md. Until it is
 * settled this screen stays on /api/admin/apps, and the notice below makes the
 * split visible rather than leaving an admin to wonder why an app they added
 * never appeared in a business's store.
 */

import { CrudSection } from '../../ui/CrudSection.jsx';
import { Notice } from '../../ui/primitives.jsx';
import { appsResource } from '../../api/resources.js';
import { columns, fields } from '../../lib/fields.jsx';

const schema = {
  groups: [
    {
      title: 'Identity',
      fields: [
        fields.text('app_id', 'App ID', {
          required: true,
          help: 'Stable identifier. Changing it on an existing app creates a new one.',
          validate: (value) =>
            value && !/^[a-z0-9_-]+$/.test(value)
              ? 'Lowercase letters, numbers, hyphens, and underscores only'
              : null,
        }),
        fields.text('name', 'Name', { required: true }),
        fields.text('icon', 'Icon', { placeholder: 'emoji or icon name' }),
        fields.textarea('description', 'Description', { rows: 3 }),
      ],
    },
    {
      title: 'Classification',
      fields: [
        fields.text('category', 'Category'),
        fields.text('type', 'Type'),
        fields.tags('business_types', 'Business types', {
          span: 'full',
          help: 'Which kinds of business can install this. Blank means all.',
        }),
      ],
    },
    {
      title: 'Commercial',
      fields: [
        fields.money('monthly_price', 'Monthly price'),
        fields.bool('active', 'Available in the store', { defaultValue: true }),
      ],
    },
    {
      title: 'Delivery',
      fields: [fields.url('script_url', 'Script URL', { span: 2 })],
    },
  ],
};

export default function AppManager() {
  return (
    <CrudSection
      title="App manager"
      description="The catalogue businesses install from."
      resource={appsResource}
      rowKey="app_id"
      labelFor={(row) => row.name || row.app_id}
      createLabel="Add app"
      modalSize="lg"
      emptyTitle="No apps"
      emptyDescription="The store is empty."
      searchPlaceholder="Search apps…"
      // Rendered above the table so the two-catalogue split is visible at the
      // point where it would otherwise cause confusion.
      children={
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Notice tone="warning" title="There are two app catalogues">
            This screen edits the <code className="mono">apps</code> table via{' '}
            <code className="mono">/api/admin/apps</code>. The owner-facing dashboard&apos;s store
            reads a different table, <code className="mono">platform_apps</code>, seeded from the
            JSON manifests in <code className="mono">cybercheck-login/apps/</code>. They do not
            sync, so an app added here will not appear in a business&apos;s store. Which catalogue
            should be canonical is still to be decided.
          </Notice>
        </div>
      }
      columns={[
        {
          key: 'name',
          header: 'App',
          render: (row) => (
            <div>
              <div className="ui-cell-primary">
                {row.icon ? `${row.icon} ` : ''}
                {row.name}
              </div>
              <div className="ui-cell-sub mono">{row.app_id}</div>
            </div>
          ),
        },
        columns.text('category', 'Category'),
        columns.text('type', 'Type'),
        columns.money('monthly_price', 'Monthly'),
        columns.tags('business_types', 'For'),
        columns.bool('active', 'Listed', { trueLabel: 'Listed', falseLabel: 'Hidden' }),
      ]}
      formSchema={schema}
    />
  );
}
