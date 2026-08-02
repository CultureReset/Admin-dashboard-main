/**
 * Trip Swipe analytics.
 *
 * GET /api/admin/tripswipe-analytics?period=week|month|…
 */

import { useState } from 'react';
import { Button, PageHeader } from '../../ui/primitives.jsx';
import { PayloadCard } from '../engagement/Analytics.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';

const PERIODS = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
];

export default function TripSwipeAnalytics() {
  const [period, setPeriod] = useState('week');

  const query = useAsync(
    async () => api.get(endpoints.analytics.tripswipe(), { query: { period } }),
    [period],
    { initialData: null },
  );

  return (
    <>
      <PageHeader
        title="Swipe analytics"
        description="Swipe volume, saves, and conversion over the selected period."
        actions={
          <>
            <select
              className="ui-input ui-input--select"
              style={{ width: 'auto' }}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {PERIODS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <Button onClick={query.reload} disabled={query.loading}>Refresh</Button>
          </>
        }
      />

      <PayloadCard
        title="Trip Swipe"
        subtitle={`Period: ${PERIODS.find((p) => p.value === period)?.label}`}
        query={query}
      />
    </>
  );
}
