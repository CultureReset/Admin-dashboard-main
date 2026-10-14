/** Accounts that can sign in. GET /api/admin/users (platform admin only). */

import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../api/paperclip.js';
import { Badge, PageHeader } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import PaperclipSignIn from './SignIn.jsx';

export default function Users() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await adminApi.users());
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="stack">
      <PageHeader title="Users" description="Everyone who can sign in, newest first (up to 50; search narrows it)." />
      {error?.isAuthError ? <PaperclipSignIn onDone={load} /> : null}
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        searchPlaceholder="Search by email or name…"
        emptyTitle="No users yet"
        columns={[
          { key: 'email', header: 'Email', render: (row) => <strong>{row.email}</strong> },
          { key: 'name', header: 'Name' },
          {
            key: 'isInstanceAdmin',
            header: 'Role',
            render: (row) => (row.isInstanceAdmin ? <Badge tone="primary">platform admin</Badge> : <Badge>member</Badge>),
          },
          { key: 'activeCompanyMembershipCount', header: 'Businesses' },
        ]}
      />
    </div>
  );
}
