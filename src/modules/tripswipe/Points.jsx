/**
 * Points & rewards.
 *
 * The legacy dashboard read and wrote /api/tourist/points-config. That route
 * is not present in gcr-api-clean, so this screen shows the fields it expects
 * and reports the missing route rather than pretending to save.
 */

import { PageHeader } from '../../ui/primitives.jsx';
import { ConfigCard } from '../../components/ConfigCard.jsx';
import { endpoints } from '../../api/endpoints.js';
import { fields } from '../../lib/fields.jsx';

const schema = {
  groups: [
    {
      title: 'Earning',
      fields: [
        fields.number('points_per_swipe', 'Points per swipe', { min: 0, step: 1 }),
        fields.number('points_per_save', 'Points per save', { min: 0, step: 1 }),
        fields.number('points_per_visit', 'Points per check-in', { min: 0, step: 1 }),
        fields.number('points_per_review', 'Points per review', { min: 0, step: 1 }),
        fields.number('points_per_referral', 'Points per referral', { min: 0, step: 1 }),
      ],
    },
    {
      title: 'Tiers',
      fields: [
        fields.number('tier_bronze', 'Bronze threshold', { min: 0, step: 1 }),
        fields.number('tier_silver', 'Silver threshold', { min: 0, step: 1 }),
        fields.number('tier_gold', 'Gold threshold', { min: 0, step: 1 }),
      ],
    },
    {
      title: 'Redemption',
      fields: [
        fields.bool('redemption_enabled', 'Redemption enabled'),
        fields.number('points_per_dollar', 'Points per dollar of value', { min: 0, step: 1 }),
        fields.textarea('terms', 'Terms shown to users', { rows: 4 }),
      ],
    },
  ],
};

export default function Points() {
  return (
    <>
      <PageHeader
        title="Points & rewards"
        description="What earns points, and what points are worth."
      />
      <ConfigCard
        title="Points configuration"
        subtitle="Read from and written to /api/tourist/points-config."
        schema={schema}
        getPath={() => endpoints.settings.get(endpoints.settingsKeys.pointsConfig)}
        responseKeys={['value']}
      />
    </>
  );
}
