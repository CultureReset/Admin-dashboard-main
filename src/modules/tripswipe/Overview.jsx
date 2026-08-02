/**
 * Trip Swipe overview — headline numbers and shortcuts into the sub-sections.
 */

import { Link } from 'react-router-dom';
import { Button, Card, ErrorState, PageHeader, Spinner, Stat } from '../../ui/primitives.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { navigation } from '../registry.js';
import { formatNumber } from '../../lib/fields.jsx';

export default function TripSwipeOverview() {
  const touristsQuery = useAsync(
    async () => unwrapList(await api.get(endpoints.tourists.list()), ['tourists']),
    [],
    { initialData: [] },
  );

  const sponsoredQuery = useAsync(
    async () => unwrapList(await api.get(endpoints.tripswipe.sponsored()), ['sponsored']),
    [],
    { initialData: [] },
  );

  const cardsQuery = useAsync(
    async () => unwrapList(await api.get(endpoints.tripswipe.promoCards()), ['cards']),
    [],
    { initialData: [] },
  );

  const settingsQuery = useAsync(
    async () => unwrapList(await api.get(endpoints.tripswipe.settings()), ['settings']),
    [],
    { initialData: [] },
  );

  const tourists = touristsQuery.data || [];
  const settings = settingsQuery.data || [];
  const inDeck = settings.filter((row) => row.is_enabled !== false).length;
  const activeCards = (cardsQuery.data || []).filter((card) => card.is_active !== false).length;

  const group = navigation.find((item) => item.key === 'tripswipe');

  const refreshAll = () => {
    touristsQuery.reload();
    sponsoredQuery.reload();
    cardsQuery.reload();
    settingsQuery.reload();
  };

  return (
    <>
      <PageHeader
        title="Trip Swipe"
        description="The tourist-facing discovery app."
        actions={<Button onClick={refreshAll}>Refresh</Button>}
      />

      {touristsQuery.error && <ErrorState error={touristsQuery.error} onRetry={touristsQuery.reload} />}

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat
          label="Tourists"
          value={touristsQuery.loading ? <Spinner size={20} /> : formatNumber(tourists.length)}
          tone="primary"
        />
        <Stat
          label="Businesses in the deck"
          value={settingsQuery.loading ? <Spinner size={20} /> : inDeck}
          hint={`${settings.length} configured`}
          tone="success"
        />
        <Stat
          label="Sponsored placements"
          value={sponsoredQuery.loading ? <Spinner size={20} /> : (sponsoredQuery.data || []).length}
        />
        <Stat
          label="Active tonight cards"
          value={cardsQuery.loading ? <Spinner size={20} /> : activeCards}
          hint={`${(cardsQuery.data || []).length} total`}
        />
      </div>

      <Card title="Trip Swipe sections">
        <div className="row-wrap" style={{ gap: 6 }}>
          {(group?.items || [])
            .filter((item) => item.path !== '/tripswipe')
            .map((item) => (
              <Link
                key={item.id}
                to={item.path}
                className="ui-multi__chip"
                style={{ textDecoration: 'none' }}
                title={item.description}
              >
                {item.icon} {item.label}
              </Link>
            ))}
        </div>
      </Card>
    </>
  );
}
