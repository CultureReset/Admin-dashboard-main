/**
 * The Calendar tab on a business's profile.
 *
 * Same panel as the standalone page at /booking/calendar/:slug — one component
 * in both places, so a business's calendar cannot look different depending on
 * how you reached it.
 */

import { Link } from 'react-router-dom';
import BusinessCalendarPanel from '../../booking/BusinessCalendarPanel.jsx';

export default function CalendarTab({ slug }) {
  return (
    <>
      <p className="muted" style={{ marginBottom: 'var(--space-4)' }}>
        Availability for this business, assembled from its forwarded confirmation emails and any
        iCal feeds it has connected.{' '}
        <Link to={`/booking/calendar/${encodeURIComponent(slug)}`}>Open as its own page</Link> ·{' '}
        <Link to="/booking/website-calendar">Embed it on their website</Link>
      </p>
      <BusinessCalendarPanel slug={slug} />
    </>
  );
}
