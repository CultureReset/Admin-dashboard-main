/**
 * Overview — the landing screen.
 *
 * Pulls real counters from the API rather than showing placeholder numbers:
 * the entity list, pending claims, active ads, and the analytics payloads.
 * Each tile fails independently, so one slow or missing route does not blank
 * the page.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, ErrorState, PageHeader, Spinner, Stat } from '../../ui/primitives.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useEntities } from '../../components/EntityPicker.jsx';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { navigation } from '../registry.js';
import { formatNumber } from '../../lib/fields.jsx';

export default function Overview() {
  const { entities, loading: entitiesLoading, error: entitiesError, reload } = useEntities();

  const claimsQuery = useAsync(
    async () => unwrapList(await api.get(endpoints.claims.list()), ['claims']),
    [],
    { initialData: [] },
  );

  const adsQuery = useAsync(
    async () => unwrapList(await api.get(endpoints.ads.list()), ['ads']),
    [],
    { initialData: [] },
  );

  const railsQuery = useAsync(
    async () => unwrapList(await api.get(endpoints.rails.list()), ['rails']),
    [],
    { initialData: [] },
  );

  const stats = useMemo(() => {
    const active = entities.filter((e) => e.is_active).length;
    const featured = entities.filter((e) => e.featured).length;
    const withHero = entities.filter((e) => e.hero_image_url).length;
    const pendingClaims = (claimsQuery.data || []).filter(
      (c) => (c.status || 'pending') === 'pending',
    ).length;
    const activeAds = (adsQuery.data || []).filter((a) => a.is_active).length;
    const activeRails = (railsQuery.data || []).filter((r) => r.is_active).length;
    return { active, featured, withHero, pendingClaims, activeAds, activeRails };
  }, [entities, claimsQuery.data, adsQuery.data, railsQuery.data]);

  const cities = useMemo(() => {
    const counts = new Map();
    for (const entity of entities) {
      if (!entity.city) continue;
      counts.set(entity.city, (counts.get(entity.city) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [entities]);

  const subtypes = useMemo(() => {
    const counts = new Map();
    for (const entity of entities) {
      const key = entity.entity_subtype || entity.entity_type;
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [entities]);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Live counters straight from the API."
        actions={
          <Button
            onClick={() => {
              reload();
              claimsQuery.reload();
              adsQuery.reload();
              railsQuery.reload();
            }}
          >
            Refresh
          </Button>
        }
      />

      {entitiesError && <ErrorState error={entitiesError} onRetry={reload} />}

      <div className="grid-auto" style={{ marginBottom: 'var(--space-5)' }}>
        <Stat
          label="Businesses"
          value={entitiesLoading ? <Spinner size={20} /> : formatNumber(entities.length)}
          hint={`${stats.active} live · ${stats.featured} featured`}
          tone="primary"
        />
        <Stat
          label="With a hero image"
          value={entitiesLoading ? <Spinner size={20} /> : formatNumber(stats.withHero)}
          hint={
            entities.length
              ? `${Math.round((stats.withHero / entities.length) * 100)}% of listings`
              : undefined
          }
        />
        <Stat
          label="Pending claims"
          value={claimsQuery.loading ? <Spinner size={20} /> : stats.pendingClaims}
          tone={stats.pendingClaims ? 'warning' : 'success'}
          hint={stats.pendingClaims ? 'Waiting on a decision' : 'Nothing waiting'}
        />
        <Stat
          label="Ads serving"
          value={adsQuery.loading ? <Spinner size={20} /> : stats.activeAds}
          hint={`${(adsQuery.data || []).length} total`}
        />
        <Stat
          label="Active rails"
          value={railsQuery.loading ? <Spinner size={20} /> : stats.activeRails}
          hint={`${(railsQuery.data || []).length} configured`}
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <Card title="Listings by city" subtitle="Top locations in the directory.">
          {cities.length === 0 ? (
            <p className="muted">No city data yet.</p>
          ) : (
            <ul className="stack-sm" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {cities.map(([city, count]) => (
                <li className="row" key={city}>
                  <span style={{ flex: 1 }}>{city}</span>
                  <Badge>{count}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Listings by type" subtitle="What the directory is made of.">
          {subtypes.length === 0 ? (
            <p className="muted">No type data yet.</p>
          ) : (
            <ul className="stack-sm" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {subtypes.map(([type, count]) => (
                <li className="row" key={type}>
                  <span style={{ flex: 1 }}>{type}</span>
                  <Badge>{count}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Jump to" subtitle="Every section in the dashboard.">
          <div className="stack">
            {navigation
              .filter((group) => group.label)
              .map((group) => (
                <div key={group.key}>
                  <div
                    className="ui-field__label"
                    style={{ marginBottom: 6 }}
                  >
                    {group.label}
                  </div>
                  <div className="row-wrap" style={{ gap: 6 }}>
                    {group.items.map((item) => (
                      <Link
                        key={item.id}
                        to={item.path}
                        className="ui-multi__chip"
                        style={{ textDecoration: 'none' }}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </>
  );
}
