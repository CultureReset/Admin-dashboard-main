/**
 * Entity Editor → Hours.
 *
 * entity_hours stores day_of_week as 0–6. Both the dedicated
 * PUT /gcr/entities/:slug/hours and the PATCH body accept the same rows;
 * the dedicated route is used because it replaces the whole week, which is
 * what "save hours" means to an admin.
 *
 * Happy hour lives on the entity row itself and has its own route.
 */

import { useEffect, useState } from 'react';
import { Button, Card, Notice } from '../../../ui/primitives.jsx';
import { SchemaForm } from '../../../ui/SchemaForm.jsx';
import { useToast } from '../../../ui/Toast.jsx';
import { api } from '../../../api/client.js';
import { endpoints } from '../../../api/endpoints.js';
import { happyHourSchema } from '../entitySchema.js';
import './HoursTab.css';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Build a full week from whatever rows the API returned. */
function toWeek(hours) {
  return DAY_NAMES.map((name, index) => {
    const existing = (hours || []).find((h) => Number(h.day_of_week) === index);
    return {
      day_of_week: index,
      name,
      opens_at: existing?.opens_at?.slice(0, 5) || '',
      closes_at: existing?.closes_at?.slice(0, 5) || '',
      is_closed: Boolean(existing?.is_closed),
    };
  });
}

export default function HoursTab({ slug, record, entity, reload }) {
  const toast = useToast();
  const [week, setWeek] = useState(() => toWeek(record?.hours));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setWeek(toWeek(record?.hours));
  }, [record]);

  const update = (index, changes) => {
    setWeek((prev) => prev.map((day, i) => (i === index ? { ...day, ...changes } : day)));
  };

  /** Copy the first open day across the rest of the week. */
  const applyToAll = () => {
    const source = week.find((d) => !d.is_closed && d.opens_at) || week[0];
    setWeek((prev) =>
      prev.map((day) => ({
        ...day,
        opens_at: source.opens_at,
        closes_at: source.closes_at,
        is_closed: source.is_closed,
      })),
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put(endpoints.entities.hours(slug), {
        hours: week.map(({ day_of_week, opens_at, closes_at, is_closed }) => ({
          day_of_week,
          opens_at: is_closed || !opens_at ? null : opens_at,
          closes_at: is_closed || !closes_at ? null : closes_at,
          is_closed,
        })),
      });
      toast.success('Hours saved.');
      await reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  const saveHappyHour = async (values) => {
    await api.put(endpoints.entities.happyHour(slug), values);
    toast.success('Happy hour saved.');
    await reload();
  };

  return (
    <div className="stack">
      <Card
        title="Opening hours"
        subtitle="Leave a day closed to hide it from the public page."
        actions={
          <>
            <Button size="sm" onClick={applyToAll}>Copy first open day to all</Button>
            <Button size="sm" variant="primary" loading={saving} onClick={save}>Save hours</Button>
          </>
        }
      >
        <div className="hours-grid">
          {week.map((day, index) => (
            <div className={`hours-row ${day.is_closed ? 'is-closed' : ''}`} key={day.day_of_week}>
              <span className="hours-row__day">{day.name}</span>
              <input
                type="time"
                className="ui-input"
                value={day.opens_at}
                disabled={day.is_closed}
                onChange={(e) => update(index, { opens_at: e.target.value })}
                aria-label={`${day.name} opening time`}
              />
              <span className="hours-row__sep">to</span>
              <input
                type="time"
                className="ui-input"
                value={day.closes_at}
                disabled={day.is_closed}
                onChange={(e) => update(index, { closes_at: e.target.value })}
                aria-label={`${day.name} closing time`}
              />
              <label className="hours-row__closed">
                <input
                  type="checkbox"
                  checked={day.is_closed}
                  onChange={(e) => update(index, { is_closed: e.target.checked })}
                />
                <span>Closed</span>
              </label>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Happy hour" subtitle="Stored on the entity row (hh_days, hh_start, hh_end, hh_description).">
        <Notice tone="info">
          Happy hour <em>items</em> are managed on the Content tab. This sets the schedule shown on the page.
        </Notice>
        <div style={{ height: 'var(--space-4)' }} />
        <SchemaForm
          schema={happyHourSchema}
          initialValues={{
            hh_days: entity?.hh_days || '',
            hh_start: entity?.hh_start?.slice(0, 5) || '',
            hh_end: entity?.hh_end?.slice(0, 5) || '',
            hh_description: entity?.hh_description || '',
          }}
          onSubmit={saveHappyHour}
          submitLabel="Save happy hour"
        />
      </Card>
    </div>
  );
}
