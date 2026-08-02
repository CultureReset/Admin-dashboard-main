/**
 * Live music artist roster.
 *
 * GET/POST /api/admin/artists, GET/PUT/DELETE /api/admin/artists/:id
 * POST /api/admin/artists/:id/photo for the image.
 */

import { useRef, useState } from 'react';
import { Button } from '../../ui/primitives.jsx';
import { CrudSection } from '../../ui/CrudSection.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { artistsResource } from '../../api/resources.js';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { columns, fields } from '../../lib/fields.jsx';

const artistSchema = {
  groups: [
    {
      title: 'Artist',
      fields: [
        fields.text('name', 'Name', { required: true, span: 2 }),
        fields.text('genre', 'Genre'),
        fields.text('hometown', 'Hometown'),
        fields.textarea('bio', 'Bio', { rows: 4 }),
        fields.image('image_url', 'Photo URL'),
      ],
    },
    {
      title: 'Links',
      fields: [
        fields.url('website_url', 'Website'),
        fields.url('spotify_url', 'Spotify'),
        fields.url('social_instagram', 'Instagram'),
        fields.url('social_facebook', 'Facebook'),
        fields.url('social_tiktok', 'TikTok'),
      ],
    },
    {
      title: 'Visibility',
      fields: [fields.bool('is_active', 'Active', { defaultValue: true })],
    },
  ],
};

export default function Artists() {
  const toast = useToast();
  const fileInput = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const pickPhoto = (artist) => {
    setUploadTarget(artist);
    fileInput.current?.click();
  };

  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !uploadTarget) return;
    try {
      const form = new FormData();
      form.append('image', file);
      await api.upload(endpoints.artists.photo(uploadTarget.id), form);
      toast.success(`Photo updated for ${uploadTarget.name}.`);
      // Force the list to refetch so the new image shows.
      setReloadKey((n) => n + 1);
    } catch (err) {
      toast.error(err);
    } finally {
      setUploadTarget(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={uploadPhoto} />
      <CrudSection
        key={reloadKey}
        title="Artists"
        description="Reusable performer profiles, linked to events across every venue."
        resource={artistsResource}
        labelFor={(row) => row.name}
        createLabel="Add artist"
        modalSize="lg"
        emptyTitle="No artists"
        emptyDescription="Add performers here so events can reference them."
        searchPlaceholder="Search artists…"
        columns={[
          columns.thumb('image_url'),
          columns.primary('name', 'Artist', 'genre'),
          columns.text('hometown', 'Hometown'),
          columns.link('spotify_url', 'Spotify', { label: 'Listen' }),
          columns.bool('is_active', 'Active'),
          {
            key: '__photo',
            header: '',
            align: 'right',
            sortable: false,
            searchable: false,
            stopPropagation: true,
            render: (row) => (
              <Button size="sm" onClick={() => pickPhoto(row)}>Upload photo</Button>
            ),
          },
        ]}
        formSchema={artistSchema}
      />
    </>
  );
}
