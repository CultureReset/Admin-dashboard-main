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

const schema = {
  groups: [
    {
      title: 'Hunt',
      fields: [
        fields.text('name', 'Name', { required: true, span: 2 }),
        fields.textarea('description', 'Description', { rows: 3 }),
        fields.image('image_url', 'Image URL'),
        fields.text('entity_slug', 'Business slug'),
      ],
    },
    {
      title: 'Location',
      fields: [
        fields.number('latitude', 'Latitude', { step: 'any' }),
        fields.number('longitude', 'Longitude', { step: 'any' }),
        fields.number('radius_meters', 'Radius (metres)', { min: 1, step: 1 }),
      ],
    },
    {
      title: 'Reward',
      fields: [
        fields.text('reward_text', 'Reward', { span: 2 }),
        fields.number('points', 'Points', { min: 0, step: 1 }),
        fields.number('max_captures', 'Max captures', { min: 0, step: 1 }),
      ],
    },
    {
      title: 'Schedule',
      fields: [
        fields.date('starts_at', 'Starts'),
        fields.date('ends_at', 'Ends'),
        fields.bool('is_active', 'Active', { defaultValue: true }),
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
        labelFor={(row) => row.name}
        createLabel="Add hunt"
        modalSize="lg"
        emptyTitle="No AR hunts"
        searchPlaceholder="Search hunts…"
        columns={[
          columns.thumb('image_url'),
          columns.primary('name', 'Hunt', 'entity_slug'),
          columns.text('reward_text', 'Reward'),
          columns.number('points', 'Points'),
          columns.number('capture_count', 'Captures'),
          columns.bool('is_active', 'Active'),
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
        title={capturesFor ? `Captures — ${capturesFor.name}` : ''}
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
        columns.dateTime('created_at', 'When'),
        columns.text('user_id', 'User'),
        columns.text('user_email', 'Email'),
        columns.bool('redeemed', 'Redeemed'),
      ]}
      rows={captures}
      rowKey={(row, index) => row.id ?? index}
      dense
      initialSort={{ key: 'created_at', direction: 'desc' }}
    />
  );
}
