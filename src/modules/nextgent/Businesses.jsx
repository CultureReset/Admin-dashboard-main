/** Every business on the platform. GET /api/companies (platform admin sees all). */

import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../api/paperclip.js';
import { Badge, PageHeader } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import PaperclipSignIn from './SignIn.jsx';

export default function Businesses() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await adminApi.businesses());
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
      <PageHeader title="Businesses" description="Every business on the platform." />
      {error?.isAuthError ? <PaperclipSignIn onDone={load} /> : null}
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        searchPlaceholder="Search businesses…"
        emptyTitle="No businesses yet"
        initialSort={{ key: 'createdAt', direction: 'desc' }}
        columns={[
          { key: 'name', header: 'Business', render: (row) => <strong>{row.name}</strong> },
          { key: 'issuePrefix', header: 'Code' },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <Badge tone={row.status === 'active' ? 'success' : 'neutral'}>{row.status}</Badge>,
          },
          { key: 'createdAt', header: 'Created', render: (row) => new Date(row.createdAt).toLocaleDateString() },
        ]}
      />
    </div>
  );
}
