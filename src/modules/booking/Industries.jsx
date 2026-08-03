/**
 * The index of industry calendars.
 *
 * One card per industry, each linking to its own page. The list comes from the
 * API rather than being written out here, because the same patterns that
 * classify a business into an industry are the ones that define which
 * industries exist — hardcoding the list in the dashboard is how the nav ends
 * up offering a page that classifies nothing.
 *
 * GET /api/admin/platform/verticals
 */

import { Link } from 'react-router-dom';
import { Badge, Card, ErrorState, LoadingBlock, Notice, PageHeader } from '../../ui/primitives.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';

/** Purely decorative; an industry with no entry here still gets its page. */
const ICONS = {
  condo: '🏢',
  hotel: '🏨',
  charter: '🎣',
  cruise: '🐬',
  watersport: '🪂',
  rental: '🚤',
  session: '📸',
  venue: '🎪',
  other: '📦',
};

export default function Industries() {
  const query = useAsync(
    async () => api.get(endpoints.bookingPlatform.verticals()),
    [],
    { initialData: null },
  );

  const verticals = Array.isArray(query.data?.verticals) ? query.data.verticals : [];

  return (
    <>
      <PageHeader
        title="Industry calendars"
        description="A calendar page per industry — charters, cruises, condos, hotels and the rest."
      />

      <Notice tone="info" title="Three ways to look at the same data">
        <p>
          <strong>Here</strong> — one industry at a time, a month at a time.{' '}
          <Link to="/booking/calendar">Business calendar</Link> — one business, its own page, also
          shown as a tab on its profile. <Link to="/booking/search">Availability Search</Link> — a
          date range across everything at once.
        </p>
      </Notice>

      <div style={{ height: 'var(--space-4)' }} />

      {query.loading && <LoadingBlock />}
      {query.error && <ErrorState error={query.error} onRetry={query.reload} />}

      {!query.loading && !query.error && (
        <div className="grid-auto">
          {verticals.map((v) => (
            <Link key={v.id} to={`/booking/industries/${encodeURIComponent(v.id)}`} className="plain-link">
              <Card title={`${ICONS[v.id] || '📁'}  ${v.label}`}>
                <p className="muted" style={{ marginBottom: 'var(--space-3)' }}>
                  {v.default_coverage === 'all'
                    ? 'Must be free every night of a stay to count as available.'
                    : 'Any open day in the window counts as available.'}
                </p>
                <Badge tone="info">counts shown as {v.unit_word}</Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
