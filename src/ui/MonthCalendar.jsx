/**
 * A month grid of availability days.
 *
 * Shared by the per-business calendar, the Entity Editor's Calendar tab and
 * the per-industry calendar, so the three cannot end up disagreeing about what
 * a colour means. Everything is passed in — the component knows nothing about
 * endpoints and does no fetching.
 *
 * A day is `{ date, status, remaining, total, assumed?, blocked_by?, sources? }`.
 * The one nuance worth stating loudly, and the reason `assumed` is rendered at
 * all: a date with no row means nothing has CLAIMED it, not that we counted
 * it. Open-because-capacity-says-so and open-because-a-booking-said-so are
 * different facts and an operator has to be able to tell them apart at a
 * glance, so assumed days are drawn hollow.
 */

import { useMemo } from 'react';
import './MonthCalendar.css';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthLabel(month) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) return month || '';
  return `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

export function shiftMonth(month, by) {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function thisMonth() {
  return new Date().toISOString().slice(0, 7);
}

/**
 * @param {string} month          YYYY-MM
 * @param {Array}  days           availability days, any order
 * @param {string} [unitWord]     what `remaining` counts — spots, units, rooms
 * @param {function} [onPickDay]  clicking a day calls this with the day object
 * @param {string} [selectedDate]
 * @param {function} [renderDay]  extra content under the count, per day
 */
export function MonthCalendar({
  month,
  days = [],
  unitWord = 'spots',
  onPickDay,
  selectedDate,
  renderDay,
  compact = false,
}) {
  const byDate = useMemo(() => {
    const map = new Map();
    for (const d of days) map.set(d.date, d);
    return map;
  }, [days]);

  const cells = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(month || '')) return [];
    const first = new Date(`${month}-01T00:00:00Z`);
    const out = [];
    for (let i = 0; i < first.getUTCDay(); i += 1) out.push(null);
    let cursor = new Date(first.getTime());
    while (cursor.toISOString().slice(0, 7) === month) {
      out.push(cursor.toISOString().slice(0, 10));
      cursor = new Date(cursor.getTime() + 86400000);
    }
    return out;
  }, [month]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className={`monthcal ${compact ? 'monthcal--compact' : ''}`.trim()}>
      <div className="monthcal__grid" role="grid" aria-label={monthLabel(month)}>
        {DOW.map((label) => (
          <div key={label} className="monthcal__dow">{compact ? label[0] : label}</div>
        ))}

        {cells.map((date, index) => {
          if (!date) return <div key={`pad-${index}`} className="monthcal__cell monthcal__cell--pad" />;
          const day = byDate.get(date) || { date, status: 'unknown', remaining: null, assumed: true };
          const past = date < today;
          const classes = [
            'monthcal__cell',
            `monthcal__cell--${day.status}`,
            day.assumed ? 'monthcal__cell--assumed' : '',
            past ? 'monthcal__cell--past' : '',
            date === today ? 'monthcal__cell--today' : '',
            date === selectedDate ? 'monthcal__cell--selected' : '',
            onPickDay ? 'monthcal__cell--clickable' : '',
          ].filter(Boolean).join(' ');

          const title = [
            date,
            day.status,
            day.remaining != null ? `${day.remaining}${day.total != null ? ` of ${day.total}` : ''} ${unitWord}` : null,
            day.blocked_by ? `blocked by ${day.blocked_by}` : null,
            day.assumed
              ? 'nothing has claimed this date'
              : (day.sources || []).length ? `from ${(day.sources || []).join(', ')}` : null,
          ].filter(Boolean).join(' · ');

          const content = (
            <>
              <span className="monthcal__num">{Number(date.slice(8, 10))}</span>
              {day.remaining != null && day.status !== 'blocked' && (
                <span className="monthcal__count">
                  {day.remaining}
                  {day.total != null && !compact ? `/${day.total}` : ''}
                </span>
              )}
              {day.status === 'blocked' && !compact && <span className="monthcal__count">blocked</span>}
              {renderDay ? renderDay(day) : null}
            </>
          );

          return onPickDay ? (
            <button key={date} type="button" className={classes} title={title} onClick={() => onPickDay(day)}>
              {content}
            </button>
          ) : (
            <div key={date} className={classes} title={title}>{content}</div>
          );
        })}
      </div>

      {/* The key is repeated per calendar, which is fine once on a page and
          absurd on a table with one mini-calendar per row. Compact drops it. */}
      {!compact && (
      <div className="monthcal__key">
        <span className="monthcal__k"><i className="monthcal__sw monthcal__sw--available" />Open</span>
        <span className="monthcal__k"><i className="monthcal__sw monthcal__sw--limited" />Almost gone</span>
        <span className="monthcal__k"><i className="monthcal__sw monthcal__sw--full" />Booked</span>
        <span className="monthcal__k"><i className="monthcal__sw monthcal__sw--blocked" />Blocked</span>
        <span className="monthcal__k"><i className="monthcal__sw monthcal__sw--unknown" />Unknown</span>
        <span className="monthcal__k monthcal__k--note">
          Hollow = nothing has claimed it, open because capacity says so
        </span>
      </div>
      )}
    </div>
  );
}

/** Prev / month / next, shared by every screen that shows a month. */
export function MonthNav({ month, onChange, minMonth, children }) {
  const atMin = minMonth ? month <= minMonth : false;
  return (
    <div className="monthcal__nav">
      <button
        type="button"
        className="ui-btn ui-btn--sm"
        disabled={atMin}
        aria-label="Previous month"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        ‹
      </button>
      <span className="monthcal__navlabel">{monthLabel(month)}</span>
      <button
        type="button"
        className="ui-btn ui-btn--sm"
        aria-label="Next month"
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        ›
      </button>
      {month !== thisMonth() && (
        <button type="button" className="ui-btn ui-btn--sm" onClick={() => onChange(thisMonth())}>
          This month
        </button>
      )}
      {children}
    </div>
  );
}

export default MonthCalendar;
