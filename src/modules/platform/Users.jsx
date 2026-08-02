/**
 * Platform users.
 *
 * GET /api/admin/users — read-only; the API exposes no user write route from
 * the admin router, so this screen lists and does not pretend to edit.
 */

import { Badge } from '../../ui/primitives.jsx';
import { ListSection } from '../../ui/CrudSection.jsx';
import { usersResource } from '../../api/resources.js';
import { columns } from '../../lib/fields.jsx';

export default function Users() {
  return (
    <ListSection
      title="Users"
      description="Accounts that can sign in. Read-only — the admin API has no user write route."
      resource={usersResource}
      searchPlaceholder="Search by email or name…"
      emptyTitle="No users"
      columns={[
        columns.primary('email', 'Email', 'name'),
        {
          key: 'role',
          header: 'Role',
          render: (row) =>
            row.role ? (
              <Badge tone={row.role === 'admin' ? 'primary' : 'neutral'}>{row.role}</Badge>
            ) : (
              <span className="faint">—</span>
            ),
        },
        columns.text('site_id', 'Site'),
        columns.dateTime('created_at', 'Created'),
        columns.dateTime('last_login', 'Last seen'),
      ]}
      initialSort={{ key: 'created_at', direction: 'desc' }}
    />
  );
}
