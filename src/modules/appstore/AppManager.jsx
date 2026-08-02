/**
 * App catalogue.
 *
 * GET/POST /api/admin/apps
 * PUT/DELETE /api/admin/apps/:appId
 */

import { CrudSection } from '../../ui/CrudSection.jsx';
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
