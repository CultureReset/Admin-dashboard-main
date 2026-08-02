/**
 * A complete list + create + edit + delete screen, from a descriptor.
 *
 * This is the workhorse of the dashboard. A section that manages a collection
 * declares its resource, its table columns, and its form schema; everything
 * else — the toolbar, the modal, the confirm dialog, the toasts, the reload
 * after a write — is handled here and behaves identically everywhere.
 *
 * Sections needing something unusual compose the same primitives directly
 * instead of contorting this component.
 */

import { useCallback, useMemo, useState } from 'react';
import { Button, Card, ErrorState, Notice, PageHeader } from './primitives.jsx';
import { DataTable } from './DataTable.jsx';
import { SchemaForm } from './SchemaForm.jsx';
import { Modal, useConfirm } from './Modal.jsx';
import { useResource } from '../hooks/useResource.js';

export function CrudSection({
  title,
  description,
  /** Resource from createResource(). */
  resource,
  /** Params forwarded to the resource's path builders (e.g. { slug }). */
  params,
  /** Query string appended to the list request. */
  query,
  /** DataTable column descriptors. The actions column is appended here. */
  columns,
  /** SchemaForm schema — array of fields, or { groups: [...] }. */
  formSchema,
  /** Map a row to form values when editing. Defaults to the row itself. */
  toFormValues,
  /** Map submitted form values to the request body. Defaults to identity. */
  fromFormValues,
  createLabel = 'Add new',
  /** Set false for read-only screens (analytics, customers). */
  canCreate = true,
  canEdit = true,
  canDelete = true,
  modalSize = 'md',
  formColumns = 2,
  labelFor,
  emptyTitle,
  emptyDescription,
  /** Extra controls rendered in the page header. */
  headerActions,
  /** Extra content above the table. */
  children,
  /** Rendered above the table when the endpoint is known to be absent. */
  unavailableNotice,
  rowKey = 'id',
  dense = false,
  searchPlaceholder,
  initialSort,
  pageSize,
}) {
  const { rows, loading, error, reload, save, remove } = useResource(resource, {
    params,
    query,
    labelFor,
  });

  const [editing, setEditing] = useState(null); // null = closed, {} = new row
  const [confirm, confirmElement] = useConfirm();

  const openCreate = useCallback(() => setEditing({}), []);
  const openEdit = useCallback((row) => setEditing(row), []);
  const close = useCallback(() => setEditing(null), []);

  const handleDelete = useCallback(
    async (row) => {
      const label = typeof labelFor === 'function' ? labelFor(row) : row?.name || row?.title || 'this record';
      const ok = await confirm({
        title: 'Delete record',
        message: `Delete ${label}? This cannot be undone.`,
        confirmLabel: 'Delete',
      });
      if (!ok) return;
      await remove(row).catch(() => {
        // useResource already surfaced the failure as a toast.
      });
    },
    [confirm, remove, labelFor],
  );

  const handleSubmit = useCallback(
    async (values) => {
      const body = fromFormValues ? fromFormValues(values, editing) : values;
      const idField = resource.idField;
      const existingId = editing?.[idField];
      // Preserve the id for updates without letting it into the form schema.
      const payload = existingId !== undefined && existingId !== null
        ? { ...body, [idField]: existingId }
        : body;
      await save(payload);
      close();
    },
    [fromFormValues, editing, resource.idField, save, close],
  );

  const tableColumns = useMemo(() => {
    if (!canEdit && !canDelete) return columns;
    return [
      ...columns,
      {
        key: '__actions',
        header: '',
        align: 'right',
        width: '1%',
        sortable: false,
        searchable: false,
        stopPropagation: true,
        render: (row) => (
          <span className="ui-cell-actions">
            {canEdit && (
              <Button size="sm" onClick={() => openEdit(row)}>
                Edit
              </Button>
            )}
            {canDelete && (
              <Button size="sm" variant="danger" onClick={() => handleDelete(row)}>
                Delete
              </Button>
            )}
          </span>
        ),
      },
    ];
  }, [columns, canEdit, canDelete, openEdit, handleDelete]);

  const isNew = editing && Object.keys(editing).length === 0;
  const initialValues = editing
    ? (toFormValues ? toFormValues(editing) : editing)
    : null;

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            {headerActions}
            <Button onClick={reload} disabled={loading}>
              Refresh
            </Button>
            {canCreate && formSchema && (
              <Button variant="primary" onClick={openCreate}>
                {createLabel}
              </Button>
            )}
          </>
        }
      />

      {unavailableNotice && error?.isMissingEndpoint && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Notice tone="warning" title="This screen's API route is not deployed">
            {unavailableNotice}
          </Notice>
        </div>
      )}

      {children}

      <Card padded={false}>
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <DataTable
            columns={tableColumns}
            rows={rows}
            loading={loading}
            error={error}
            onRetry={reload}
            rowKey={rowKey}
            dense={dense}
            pageSize={pageSize}
            initialSort={initialSort}
            searchPlaceholder={searchPlaceholder}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            emptyAction={
              canCreate && formSchema ? (
                <Button variant="primary" onClick={openCreate}>
                  {createLabel}
                </Button>
              ) : null
            }
          />
        </div>
      </Card>

      {formSchema && (
        <Modal
          open={Boolean(editing)}
          onClose={close}
          size={modalSize}
          title={isNew ? createLabel : 'Edit record'}
        >
          {editing && (
            <SchemaForm
              schema={formSchema}
              initialValues={initialValues}
              columns={formColumns}
              onSubmit={handleSubmit}
              onCancel={close}
              submitLabel={isNew ? 'Create' : 'Save changes'}
            />
          )}
        </Modal>
      )}

      {confirmElement}
    </>
  );
}

/** Read-only variant — same table, no write controls. */
export function ListSection(props) {
  return <CrudSection {...props} canCreate={false} canEdit={false} canDelete={false} />;
}

export { ErrorState };
export default CrudSection;
