/**
 * Loads and saves a single entity, shared by every Entity Editor tab.
 *
 * GET   /api/admin/gcr/entities/:slug  → { entity, hours, photos, tags }
 * PATCH /api/admin/gcr/entities/:slug  → partial update
 *
 * The PATCH route answers 207 with `{ success: false, errors: [...] }` when
 * some parts of a multi-part write fail. A 207 passes `response.ok`, so
 * without the check below a partial failure would look like a clean save.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';
import { ApiError } from '../../api/client.js';
import { useToast } from '../../ui/Toast.jsx';

export function useEntityRecord(slug) {
  const toast = useToast();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(Boolean(slug));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!slug) {
      setRecord(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await api.get(endpoints.entities.detail(slug));
      const next = {
        entity: payload?.entity || null,
        hours: payload?.hours || [],
        photos: payload?.photos || [],
        tags: payload?.tags || [],
      };
      setRecord(next);
      return next;
    } catch (err) {
      setError(err);
      setRecord(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Send a partial update. `patch` is any subset of the PATCH body:
   * { entity, hours, happyHour, tags, photos, events, specials, … }
   */
  const patch = useCallback(
    async (body, { successMessage = 'Saved.', reload = true } = {}) => {
      if (!slug) throw new Error('No entity selected');
      setSaving(true);
      try {
        const result = await api.patch(endpoints.entities.patch(slug), body);
        // 207: some parts of the write failed even though the status was 2xx.
        if (result && result.success === false) {
          const detail = Array.isArray(result.errors) ? result.errors.join('; ') : 'Partial failure';
          throw new ApiError(detail, { status: 207, path: endpoints.entities.patch(slug), body: result });
        }
        toast.success(successMessage);
        if (reload) await load();
        return result;
      } catch (err) {
        toast.error(err);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [slug, load, toast],
  );

  return { record, entity: record?.entity || null, loading, error, saving, reload: load, patch };
}

export default useEntityRecord;
