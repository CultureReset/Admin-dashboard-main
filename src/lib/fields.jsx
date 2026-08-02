/**
 * Shared field descriptors, option lists, and column renderers.
 *
 * Option lists that the API can supply (entity subtypes, taxonomy) are fetched
 * rather than typed out. The few genuinely fixed lists — days of the week,
 * claim statuses defined by the API's own enum — live here as named constants
 * so a section never inlines a magic string.
 */

import { Badge } from '../ui/primitives.jsx';

/* ------------------------------------------------------------- constants -- */

export const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

/** Matches the statuses the claims PATCH route accepts. */
export const CLAIM_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export const PRICE_RANGES = [
  { value: '$', label: '$ — inexpensive' },
  { value: '$$', label: '$$ — moderate' },
  { value: '$$$', label: '$$$ — pricey' },
  { value: '$$$$', label: '$$$$ — high end' },
];

/* ------------------------------------------------------------ formatting -- */

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toLocaleString();
}

/** First non-empty value among several candidate keys. */
export function pick(row, ...keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

/* --------------------------------------------------------- column makers -- */

export const columns = {
  text: (key, header, extra = {}) => ({ key, header, ...extra }),

  primary: (key, header, subKey) => ({
    key,
    header,
    render: (row) => (
      <div>
        <div className="ui-cell-primary">{row[key] || <span className="faint">—</span>}</div>
        {subKey && row[subKey] && <div className="ui-cell-sub mono">{row[subKey]}</div>}
      </div>
    ),
  }),

  thumb: (key, header = '') => ({
    key,
    header,
    width: '56px',
    sortable: false,
    searchable: false,
    render: (row) =>
      row[key] ? (
        <img className="ui-cell-thumb" src={row[key]} alt="" loading="lazy" />
      ) : (
        <div className="ui-cell-thumb" aria-hidden="true" />
      ),
  }),

  date: (key, header) => ({
    key,
    header,
    render: (row) => formatDate(row[key]) || <span className="faint">—</span>,
  }),

  dateTime: (key, header) => ({
    key,
    header,
    render: (row) => formatDateTime(row[key]) || <span className="faint">—</span>,
  }),

  money: (key, header) => ({
    key,
    header,
    align: 'right',
    render: (row) => formatMoney(row[key]) || <span className="faint">—</span>,
  }),

  number: (key, header) => ({
    key,
    header,
    align: 'right',
    render: (row) => formatNumber(row[key]),
  }),

  bool: (key, header, { trueLabel = 'Yes', falseLabel = 'No' } = {}) => ({
    key,
    header,
    render: (row) =>
      row[key] ? (
        <Badge tone="success">{trueLabel}</Badge>
      ) : (
        <Badge>{falseLabel}</Badge>
      ),
  }),

  /** Status pill with a tone lookup, e.g. { approved: 'success' }. */
  status: (key, header, tones = {}) => ({
    key,
    header,
    render: (row) => {
      const value = row[key];
      if (!value) return <span className="faint">—</span>;
      return <Badge tone={tones[value] || 'neutral'}>{String(value)}</Badge>;
    },
  }),

  link: (key, header, { href, label } = {}) => ({
    key,
    header,
    render: (row) => {
      const url = typeof href === 'function' ? href(row) : row[key];
      if (!url) return <span className="faint">—</span>;
      return (
        <a href={url} target="_blank" rel="noreferrer noopener">
          {typeof label === 'function' ? label(row) : label || 'Open'}
        </a>
      );
    },
  }),

  tags: (key, header) => ({
    key,
    header,
    render: (row) => {
      const value = row[key];
      const list = Array.isArray(value) ? value : value ? String(value).split(',') : [];
      if (list.length === 0) return <span className="faint">—</span>;
      return (
        <span className="row-wrap" style={{ gap: 4 }}>
          {list.slice(0, 4).map((tag) => (
            <Badge key={String(tag)}>{String(tag).trim()}</Badge>
          ))}
          {list.length > 4 && <span className="faint">+{list.length - 4}</span>}
        </span>
      );
    },
  }),
};

/* ---------------------------------------------------------- field makers -- */

export const fields = {
  text: (name, label, extra = {}) => ({ name, label, type: 'text', ...extra }),
  textarea: (name, label, extra = {}) => ({ name, label, type: 'textarea', span: 'full', ...extra }),
  url: (name, label, extra = {}) => ({ name, label, type: 'url', ...extra }),
  email: (name, label, extra = {}) => ({ name, label, type: 'email', ...extra }),
  tel: (name, label, extra = {}) => ({ name, label, type: 'tel', ...extra }),
  number: (name, label, extra = {}) => ({ name, label, type: 'number', ...extra }),
  money: (name, label, extra = {}) => ({ name, label, type: 'number', step: '0.01', min: 0, ...extra }),
  date: (name, label, extra = {}) => ({ name, label, type: 'date', ...extra }),
  time: (name, label, extra = {}) => ({ name, label, type: 'time', ...extra }),
  datetime: (name, label, extra = {}) => ({ name, label, type: 'datetime', ...extra }),
  bool: (name, label, extra = {}) => ({ name, label, type: 'boolean', ...extra }),
  select: (name, label, options, extra = {}) => ({ name, label, type: 'select', options, ...extra }),
  tags: (name, label, extra = {}) => ({ name, label, type: 'tags', ...extra }),
  image: (name, label, extra = {}) => ({ name, label, type: 'image', span: 'full', ...extra }),
  json: (name, label, extra = {}) => ({ name, label, type: 'json', span: 'full', ...extra }),
  days: (name, label = 'Days', extra = {}) => ({
    name,
    label,
    type: 'multiselect',
    options: DAYS_OF_WEEK,
    span: 'full',
    ...extra,
  }),
  sortOrder: (name = 'sort_order', label = 'Sort order') => ({
    name,
    label,
    type: 'number',
    step: 1,
    help: 'Lower numbers appear first.',
  }),
};
