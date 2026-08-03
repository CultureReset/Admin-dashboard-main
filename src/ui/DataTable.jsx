/**
 * Column-descriptor driven table with search, sort, and pagination built in.
 *
 * A column descriptor:
 *   {
 *     key: 'name',                       // property on the row
 *     header: 'Name',
 *     render: (row) => node,             // custom cell
 *     value: (row) => primitive,         // used for sorting/searching
 *     sortable: true,
 *     searchable: true,
 *     width: '180px',
 *     align: 'left' | 'right' | 'center',
 *   }
 */

import { useMemo, useState } from 'react';
import { Button, EmptyState, LoadingBlock, ErrorState, SearchInput } from './primitives.jsx';
import { config } from '../config/env.js';
import './DataTable.css';

function cellValue(column, row) {
  if (typeof column.value === 'function') return column.value(row);
  if (column.key) return row?.[column.key];
  return undefined;
}

function compare(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const as = String(a).toLowerCase();
  const bs = String(b).toLowerCase();
  return as < bs ? -1 : as > bs ? 1 : 0;
}

export function DataTable({
  columns,
  rows,
  loading = false,
  error = null,
  onRetry,
  rowKey = 'id',
  onRowClick,
  actions,
  /** Built-in client-side search. Pass `searchable={false}` for server search. */
  searchable = true,
  searchPlaceholder = 'Search…',
  externalSearch,
  onExternalSearchChange,
  emptyTitle = 'No records',
  emptyDescription,
  emptyAction,
  pageSize = config.defaultPageSize,
  paginate = true,
  toolbar,
  dense = false,
  initialSort,
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initialSort || null);
  const [page, setPage] = useState(0);

  const usingExternalSearch = typeof onExternalSearchChange === 'function';
  const searchValue = usingExternalSearch ? externalSearch ?? '' : query;

  const filtered = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    if (usingExternalSearch || !searchable || !query.trim()) return list;
    const needle = query.trim().toLowerCase();
    const searchCols = columns.filter((c) => c.searchable !== false);
    return list.filter((row) =>
      searchCols.some((col) => {
        const value = cellValue(col, row);
        return value != null && String(value).toLowerCase().includes(needle);
      }),
    );
  }, [rows, query, columns, searchable, usingExternalSearch]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((c) => (c.key || c.header) === sort.key);
    if (!column) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const result = compare(cellValue(column, a), cellValue(column, b));
      return sort.direction === 'desc' ? -result : result;
    });
    return copy;
  }, [filtered, sort, columns]);

  const totalPages = paginate ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages - 1);
  const visible = paginate ? sorted.slice(safePage * pageSize, safePage * pageSize + pageSize) : sorted;

  const toggleSort = (column) => {
    if (column.sortable === false) return;
    const key = column.key || column.header;
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  };

  const handleSearch = (value) => {
    setPage(0);
    if (usingExternalSearch) onExternalSearchChange(value);
    else setQuery(value);
  };

  return (
    <div className="ui-table-wrap">
      {(searchable || toolbar || actions) && (
        <div className="ui-table__toolbar">
          {searchable && (
            <SearchInput value={searchValue} onChange={handleSearch} placeholder={searchPlaceholder} />
          )}
          {toolbar}
          <div className="spacer" />
          {actions}
        </div>
      )}

      {error && <ErrorState error={error} onRetry={onRetry} />}

      {loading ? (
        <LoadingBlock />
      ) : !error && sorted.length === 0 ? (
        <EmptyState
          title={searchValue ? 'No matches' : emptyTitle}
          description={searchValue ? `Nothing matched “${searchValue}”.` : emptyDescription}
          action={searchValue ? null : emptyAction}
        />
      ) : !error ? (
        <div className="ui-table__scroll">
          <table className={`ui-table ${dense ? 'ui-table--dense' : ''}`}>
            <thead>
              <tr>
                {columns.map((column) => {
                  const key = column.key || column.header;
                  const active = sort?.key === key;
                  return (
                    <th
                      key={key}
                      style={{ width: column.width, textAlign: column.align || 'left' }}
                      className={[
                        column.sortable === false ? '' : 'is-sortable',
                        // `hideOn: 'narrow'` drops a column on a phone rather
                        // than pushing the whole table into a sideways scroll
                        // nobody discovers. For columns that carry detail, not
                        // identity — a mini chart, a secondary timestamp.
                        column.hideOn === 'narrow' ? 'ui-table__hide-narrow' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => toggleSort(column)}
                    >
                      <span className="ui-table__th">
                        {column.header}
                        {active && (
                          <span className="ui-table__sort" aria-hidden="true">
                            {sort.direction === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => {
                const key = typeof rowKey === 'function' ? rowKey(row, index) : row?.[rowKey] ?? index;
                return (
                  <tr
                    key={key}
                    className={onRowClick ? 'is-clickable' : ''}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key || column.header}
                        style={{ textAlign: column.align || 'left' }}
                        className={column.hideOn === 'narrow' ? 'ui-table__hide-narrow' : undefined}
                        onClick={
                          column.stopPropagation ? (e) => e.stopPropagation() : undefined
                        }
                      >
                        {column.render ? column.render(row, index) : formatCell(cellValue(column, row))}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {paginate && !loading && !error && sorted.length > pageSize && (
        <div className="ui-table__pager">
          <span className="muted">
            {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="spacer" />
          <Button size="sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            Previous
          </Button>
          <span className="muted">
            Page {safePage + 1} / {totalPages}
          </span>
          <Button size="sm" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function formatCell(value) {
  if (value === null || value === undefined || value === '') return <span className="faint">—</span>;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return <span className="mono faint">{JSON.stringify(value)}</span>;
  return String(value);
}

export default DataTable;
