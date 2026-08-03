/**
 * A page of its own for one business's calendar.
 *
 * `/booking/calendar/:slug` is the linkable form; landing on `/booking/calendar`
 * with nothing chosen falls back to the picker. The same panel is mounted as
 * the Entity Editor's Calendar tab, so a business's calendar looks identical
 * whichever way you reached it.
 */

import { useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, PageHeader } from '../../ui/primitives.jsx';
import { EntityPicker } from '../../components/EntityPicker.jsx';
import BusinessCalendarPanel from './BusinessCalendarPanel.jsx';

export default function BusinessCalendar() {
  const { slug } = useParams();
  const navigate = useNavigate();

  // The slug lives in the URL, not in state, so the page can be linked to,
  // bookmarked and opened from a search result.
  const pick = useCallback(
    (next) => navigate(next ? `/booking/calendar/${encodeURIComponent(next)}` : '/booking/calendar'),
    [navigate],
  );

  return (
    <>
      <PageHeader
        title="Business calendar"
        description="One business, one month — what is open, what claimed each date, and its units."
        actions={
          slug && (
            <>
              {/* Link, not Button — Button renders a <button> and swallowing a
                  navigation into an onClick loses middle-click and open-in-tab. */}
              <Link className="ui-btn ui-btn--default ui-btn--md" to={`/directory/entity/${encodeURIComponent(slug)}`}>
                Open profile
              </Link>
              <Link className="ui-btn ui-btn--primary ui-btn--md" to="/booking/website-calendar">
                Embed on their site
              </Link>
            </>
          )
        }
      />

      <Card>
        <div className="row-wrap" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
          <div style={{ minWidth: 240, flex: 1, maxWidth: 340 }}>
            <EntityPicker value={slug || null} onChange={pick} label={null} placeholder="Pick a business…" />
          </div>
          <span className="muted">
            Every business has its own calendar page. For a whole industry at once, use{' '}
            <Link to="/booking/industries">Industry Calendars</Link>.
          </span>
        </div>
      </Card>

      <div style={{ height: 'var(--space-4)' }} />

      <BusinessCalendarPanel slug={slug || null} />
    </>
  );
}
