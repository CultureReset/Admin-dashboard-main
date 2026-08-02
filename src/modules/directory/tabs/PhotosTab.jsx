/**
 * Entity Editor → Photos.
 *
 * POST   /api/admin/gcr/entities/:slug/photos   add by URL
 * POST   /api/admin/gcr/upload-image            upload a file to entity-media
 * DELETE /api/admin/gcr/photos/:id              remove
 *
 * The legacy dashboard could only add photos by URL. The upload route exists
 * on the API, so file upload is wired here too.
 */

import { useRef, useState } from 'react';
import { Badge, Button, Card, EmptyState, Notice } from '../../../ui/primitives.jsx';
import { SchemaForm } from '../../../ui/SchemaForm.jsx';
import { Modal, useConfirm } from '../../../ui/Modal.jsx';
import { useToast } from '../../../ui/Toast.jsx';
import { api } from '../../../api/client.js';
import { endpoints } from '../../../api/endpoints.js';
import { fields } from '../../../lib/fields.jsx';
import './PhotosTab.css';

const photoSchema = [
  fields.image('url', 'Photo URL', { required: true }),
  fields.text('caption', 'Caption', { span: 'full' }),
  fields.bool('is_cover', 'Cover photo', { checkboxLabel: 'Use as the cover image' }),
  fields.sortOrder(),
];

export default function PhotosTab({ slug, record, reload }) {
  const toast = useToast();
  const photos = record?.photos || [];
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirm, confirmElement] = useConfirm();
  const fileInput = useRef(null);

  const addByUrl = async (values) => {
    await api.post(endpoints.entities.photos(slug), values);
    toast.success('Photo added.');
    setAdding(false);
    await reload();
  };

  const upload = async (event) => {
    const files = [...(event.target.files || [])];
    if (files.length === 0) return;
    setUploading(true);
    let added = 0;
    try {
      for (const file of files) {
        const form = new FormData();
        form.append('image', file);
        form.append('entity_slug', slug);
        // Returns { url, path } after storing in the entity-media bucket.
        const result = await api.upload(endpoints.entities.uploadImage(), form);
        const url = result?.url;
        if (!url) throw new Error('Upload succeeded but no URL was returned');
        await api.post(endpoints.entities.photos(slug), {
          url,
          image_path: result.path || null,
          sort_order: photos.length + added,
        });
        added += 1;
      }
      toast.success(`${added} photo${added === 1 ? '' : 's'} uploaded.`);
      await reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const remove = async (photo) => {
    const ok = await confirm({
      title: 'Delete photo',
      message: 'Remove this photo from the entity?',
    });
    if (!ok) return;
    try {
      await api.del(endpoints.entities.photo(photo.id));
      toast.success('Photo removed.', 'Deleted');
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  const makeCover = async (photo) => {
    try {
      // The cover flag lives on the entity's hero image; setting it here
      // updates the entity row so the public page picks it up.
      await api.patch(endpoints.entities.patch(slug), {
        entity: { hero_image_url: photo.url, hero_image_path: photo.image_path || null },
      });
      toast.success('Hero image updated.');
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <>
      <Card
        title={`Photos (${photos.length})`}
        subtitle="Uploads go to the entity-media bucket. URLs are stored as-is."
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={upload}
            />
            <Button size="sm" loading={uploading} onClick={() => fileInput.current?.click()}>
              Upload files
            </Button>
            <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
              Add by URL
            </Button>
          </>
        }
      >
        {photos.length === 0 ? (
          <EmptyState
            icon="🖼️"
            title="No photos yet"
            description="Upload files or paste an image URL to build the gallery."
          />
        ) : (
          <div className="photos-grid">
            {photos.map((photo) => (
              <figure className="photo-card" key={photo.id || photo.url}>
                <img src={photo.url} alt={photo.caption || ''} loading="lazy" />
                <figcaption>
                  {photo.caption && <span className="photo-card__caption truncate">{photo.caption}</span>}
                  {photo.is_cover && <Badge tone="primary">Cover</Badge>}
                </figcaption>
                <div className="photo-card__actions">
                  <Button size="sm" onClick={() => makeCover(photo)}>Set as hero</Button>
                  <Button size="sm" variant="danger" onClick={() => remove(photo)}>Delete</Button>
                </div>
              </figure>
            ))}
          </div>
        )}
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add photo by URL">
        <Notice tone="info">
          The URL is stored directly. To host the file on GCR storage instead, use “Upload files”.
        </Notice>
        <div style={{ height: 'var(--space-4)' }} />
        <SchemaForm
          schema={photoSchema}
          initialValues={{ sort_order: photos.length }}
          onSubmit={addByUrl}
          onCancel={() => setAdding(false)}
          submitLabel="Add photo"
        />
      </Modal>

      {confirmElement}
    </>
  );
}
