/**
 * Data — one screen for every list the API registers for admins.
 *
 *   GET    /api/admin/data/resources        which lists exist, grouped
 *   GET    /api/admin/data/:key             rows + columns (paged, searched, sorted on the server)
 *   POST   /api/admin/data/:key             create
 *   PATCH  /api/admin/data/:key/:id         edit
 *   DELETE /api/admin/data/:key/:id         delete (403 where the registry forbids it)
 *
 * Nothing here names a table or a column. The picker, the table and the form
 * are all built from the registry row and the `columns` the API reports, so a
 * new registry row appears here with no dashboard change.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader } from '../../ui/primitives.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { SchemaForm } from '../../ui/SchemaForm.jsx';
import { Modal, useConfirm } from '../../ui/Modal.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAsync, useDebounced } from '../../hooks/useAsync.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import {
  buildFields,
  buildTableColumns,
  fieldErrorsFrom,
  humanize,
  readOnlyFacts,
  rowLabel,
  toBody,
  toFormValues,
} from './dataSchema.jsx';
import './Data.css';

const PAGE_SIZE = 25;

/** Resources grouped by group_label, groups and members in the order the API sent them. */
function groupResources(resources) {
  const groups = new Map();
  for (const r of resources) {
    const label = r.group_label || 'Other';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(r);
  }
  return [...groups.entries()];
}

function ResourcePicker({ resources, activeKey, onPick }) {
  return (
    <nav className="data-picker" aria-label="Lists">
      {groupResources(resources).map(([group, items]) => (
        <div className="data-picker__group" key={group} role="group" aria-label={group}>
          <span className="data-picker__label">{group}</span>
          <div className="ui-multi">
            {items.map((r) => (
              <button
                key={r.key}
                type="button"
                className={`ui-multi__chip ${r.key === activeKey ? 'is-active' : ''}`}
                aria-pressed={r.key === activeKey}
                onClick={() => onPick(r.key)}
              >
                {r.label || humanize(r.key)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function ReadOnlyFacts({ items }) {
  if (!items.length) return null;
  return (
    <dl className="data-meta">
      {items.map((i) => (
        <div key={i.name}>
          <dt>{i.label}</dt>
          <dd className="mono">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ResourceView({ resource }) {
  const toast = useToast();
  const [confirm, confirmElement] = useConfirm();

  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 300);
  const [sort, setSort] = useState(null); // { key, direction } — null means the server's default order
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState(null); // null closed · {} new · row
  const [fieldErrors, setFieldErrors] = useState(null);
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState(null);

  const key = resource.key;
  const load = useCallback(
    () =>
      api.get(endpoints.adminData.list(key), {
        query: {
          limit: PAGE_SIZE,
          offset,
          q: q || undefined,
          sort: sort?.key,
          dir: sort?.direction,
        },
      }),
    [key, offset, q, sort],
  );
  const { data, error, loading, reload } = useAsync(load, [load]);

  // A new search or order starts again from the first page.
  useEffect(() => setOffset(0), [q, sort]);

  const columns = useMemo(() => data?.columns || [], [data]);
  const rows = useMemo(() => unwrapList(data, ['rows']), [data]);
  const total = typeof data?.total === 'number' ? data.total : null;
  const creating = editing !== null && Object.keys(editing).length === 0;

  const tableColumns = useMemo(() => buildTableColumns(columns, resource), [columns, resource]);

  const actionColumn = useMemo(
    () => ({
      key: '__actions',
      header: '',
      align: 'right',
      width: '1%',
      sortable: false,
      stopPropagation: true,
      render: (row) => (
        <span className="ui-cell-actions">
          <Button size="sm" onClick={() => openEdit(row)}>
            Edit
          </Button>
          {resource.can_delete && (
            <Button size="sm" variant="danger" onClick={() => handleDelete(row)}>
              Delete
            </Button>
          )}
        </span>
      ),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resource, columns, rows],
  );

  const openCreate = () => {
    setFieldErrors(null);
    setEditing({});
  };
  function openEdit(row) {
    setFieldErrors(null);
    setEditing(row);
  }
  const close = () => {
    setEditing(null);
    setFieldErrors(null);
  };

  const schema = useMemo(
    () => (editing ? buildFields(columns, resource, { creating, rows, row: creating ? null : editing }) : []),
    [editing, columns, resource, creating, rows],
  );
  const initialValues = useMemo(() => (editing ? toFormValues(columns, creating ? null : editing) : null), [editing, columns, creating]);

  async function handleSubmit(values) {
    const body = toBody(values, columns, { creating });
    try {
      const res = creating
        ? await api.post(endpoints.adminData.create(key), body)
        : await api.patch(endpoints.adminData.item(key, editing[resource.id_column]), body);
      setActionError(null);
      setNote(res?.note || '');
      toast.success(creating ? 'Added.' : 'Saved.');
      close();
      if (creating) setOffset(0);
      await reload().catch(() => {});
    } catch (err) {
      if (err?.status === 400) setFieldErrors(fieldErrorsFrom(err, columns));
      throw err; // SchemaForm shows the message above the buttons
    }
  }

  async function handleDelete(row) {
    const label = rowLabel(row, resource);
    const ok = await confirm({
      title: 'Delete row',
      message: `Delete “${label}”? This cannot be undone.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await api.del(endpoints.adminData.item(key, row[resource.id_column]));
      setActionError(null);
      setNote('');
      toast.success(`Deleted “${label}”.`);
      if (rows.length === 1 && offset > 0) setOffset(Math.max(0, offset - PAGE_SIZE));
      else await reload().catch(() => {});
    } catch (err) {
      setActionError(err);
      toast.error(err);
    }
  }

  const labelName = humanize(resource.label_column);
  const restrictions = [
    !resource.can_create && 'new rows cannot be added here',
    !resource.can_delete && 'rows cannot be deleted here',
  ].filter(Boolean);

  return (
    <>
      {note && (
        <Notice tone="info" title="Heads up">
          {note}
        </Notice>
      )}
      {actionError && (
        <ErrorState error={actionError} context="The row was not deleted." />
      )}
      {restrictions.length > 0 && (
        <p className="data-restrictions muted">
          For this list, {restrictions.join(' and ')}
          {!resource.can_delete ? '. Edit a row to switch it off instead' : ''}.
        </p>
      )}

      <Card padded={false}>
        <div className="data-card">
          <DataTable
            columns={[...tableColumns, actionColumn]}
            rows={rows}
            rowKey={(row, i) => row?.[resource.id_column] ?? i}
            loading={loading}
            error={error}
            onRetry={reload}
            searchable
            searchPlaceholder={`Search by ${labelName.toLowerCase()}`}
            externalSearch={search}
            onExternalSearchChange={setSearch}
            sortState={sort}
            onSortChange={setSort}
            serverPage={{ offset, limit: PAGE_SIZE, total, onChange: setOffset }}
            onRowClick={openEdit}
            emptyTitle={`No ${(resource.label || 'rows').toLowerCase()} yet`}
            emptyDescription={resource.can_create ? 'Add the first one with the button above.' : 'Nothing is stored here yet.'}
            actions={
              <>
                <Button onClick={reload} disabled={loading}>
                  Refresh
                </Button>
                <Button
                  variant="primary"
                  onClick={openCreate}
                  disabled={!resource.can_create || loading || Boolean(error)}
                  title={resource.can_create ? undefined : 'New rows cannot be added to this list here.'}
                >
                  Add new
                </Button>
              </>
            }
          />
        </div>
      </Card>

      <Modal
        open={editing !== null}
        onClose={close}
        size="md"
        title={creating ? `Add to ${resource.label}` : `Edit “${editing ? rowLabel(editing, resource) : ''}”`}
      >
        {editing !== null && (
          <>
            {!creating && <ReadOnlyFacts items={readOnlyFacts(columns, resource, editing)} />}
            <SchemaForm
              schema={schema}
              initialValues={initialValues}
              onSubmit={handleSubmit}
              onCancel={close}
              submitLabel={creating ? 'Add' : 'Save'}
              columns={1}
              fieldErrors={fieldErrors}
            />
          </>
        )}
      </Modal>
      {confirmElement}
    </>
  );
}

export default function Data() {
  const [params, setParams] = useSearchParams();
  const { data, error, loading, reload } = useAsync(() => api.get(endpoints.adminData.resources()), []);
  const resources = useMemo(() => unwrapList(data, ['resources']), [data]);
  const active = resources.find((r) => r.key === params.get('list')) || resources[0] || null;

  const pick = (key) => setParams({ list: key }, { replace: true });

  return (
    <>
      <PageHeader
        title="Data"
        description={
          active
            ? `${active.group_label ? `${active.group_label} · ` : ''}${active.label}. Edit the rows directly; changes apply as soon as you save.`
            : 'Browse and edit the lists the API registers for admins.'
        }
      />
      {loading && !data ? (
        <LoadingBlock label="Loading lists…" />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !active ? (
        <EmptyState title="No lists are registered" description="Nothing has been made editable here yet." />
      ) : (
        <>
          <ResourcePicker resources={resources} activeKey={active.key} onPick={pick} />
          {/* keyed so a different list starts with a clean search, sort and page */}
          <ResourceView key={active.key} resource={active} />
        </>
      )}
    </>
  );
}
