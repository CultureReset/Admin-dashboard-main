/**
 * AR scavenger hunts.
 *
 * GET/POST /api/ar-hunts
 * PATCH/DELETE /api/ar-hunts/:id
 * GET /api/ar-hunts/:id/captures
 * POST /api/ar-hunts/redeem
 */

import { useState } from 'react';
import { Button, EmptyState, ErrorState, LoadingBlock } from '../../ui/primitives.jsx';
import { CrudSection } from '../../ui/CrudSection.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { arHuntsResource } from '../../api/resources.js';
import { api, unwrapList } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, fields } from '../../lib/fields.jsx';

// The API speaks its own client shape (routes/ar-hunts.js toClientShape):
// GET returns, and POST / PATCH accept, camelCase fields — brandName,
// imageData, latitude, longitude, reward, points, maxCaptures, startsAt,
// endsAt, active, captureRadiusMeters (5–500 m). POST requires brandName and
// both coordinates.
const schema = {
  groups: [
    {
      title: 'Hunt',
      fields: [
        fields.text('brandName', 'Brand / name', { required: true, span: 2 }),
        fields.textarea('hint', 'Hint', { rows: 2 }),
        fields.image('imageData', 'Image URL'),
        fields.select('difficulty', 'Difficulty', ['easy', 'medium', 'hard'], { defaultValue: 'medium' }),
      ],
    },
    {
      title: 'Location',
      fields: [
        fields.number('latitude', 'Latitude', { step: 'any', required: true }),
        fields.number('longitude', 'Longitude', { step: 'any', required: true }),
        fields.number('captureRadiusMeters', 'Capture radius (metres)', {
          min: 5,
          max: 500,
          step: 1,
          help: 'Between 5 and 500. Leave blank for the default.',
        }),
      ],
    },
    {
      title: 'Reward',
      fields: [
        fields.text('reward', 'Reward', { span: 2 }),
        fields.number('points', 'Points', { min: 0, step: 1, defaultValue: 100 }),
        fields.number('maxCaptures', 'Max captures', { min: 0, step: 1 }),
      ],
    },
    {
      title: 'Schedule',
      fields: [
        fields.date('startsAt', 'Starts'),
        fields.date('endsAt', 'Ends'),
        fields.bool('active', 'Active', { defaultValue: true }),
      ],
    },
  ],
};

export default function ArHunts() {
  const [capturesFor, setCapturesFor] = useState(null);

  return (
    <>
      <CrudSection
        title="AR hunts"
        description="Location-based scavenger hunts and the rewards they hand out."
        resource={arHuntsResource}
        labelFor={(row) => row.brandName}
        createLabel="Add hunt"
        modalSize="lg"
        emptyTitle="No AR hunts"
        searchPlaceholder="Search hunts…"
        columns={[
          columns.thumb('imageData'),
          columns.primary('brandName', 'Hunt', 'hint'),
          columns.text('reward', 'Reward'),
          columns.number('points', 'Points'),
          {
            key: 'captures',
            header: 'Captures',
            align: 'right',
            render: (row) => `${row.captures ?? 0}${row.maxCaptures != null ? ` / ${row.maxCaptures}` : ''}`,
          },
          columns.bool('active', 'Active'),
          {
            key: '__captures',
            header: '',
            align: 'right',
            sortable: false,
            searchable: false,
            stopPropagation: true,
            render: (row) => (
              <Button size="sm" onClick={() => setCapturesFor(row)}>Captures</Button>
            ),
          },
        ]}
        formSchema={schema}
      />

      <Modal
        open={Boolean(capturesFor)}
        onClose={() => setCapturesFor(null)}
        size="lg"
        title={capturesFor ? `Captures — ${capturesFor.brandName}` : ''}
      >
        {capturesFor && <CaptureList huntId={capturesFor.id} />}
      </Modal>
    </>
  );
}

function CaptureList({ huntId }) {
  const { data, loading, error, reload } = useAsync(
    async () => unwrapList(await api.get(endpoints.arHunts.captures(huntId)), ['captures']),
    [huntId],
    { initialData: [] },
  );

  const captures = data || [];

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (captures.length === 0) {
    return <EmptyState icon="🗺️" title="No captures" description="Nobody has found this one yet." />;
  }

  return (
    <DataTable
      columns={[
        columns.dateTime('captured_at', 'When'),
        columns.text('user_id', 'User'),
        columns.text('reward_code', 'Reward code'),
        columns.number('distance_meters', 'Distance (m)'),
        columns.dateTime('redeemed_at', 'Redeemed'),
      ]}
      rows={captures}
      rowKey={(row, index) => row.id ?? index}
      dense
      initialSort={{ key: 'captured_at', direction: 'desc' }}
    />
  );
}
