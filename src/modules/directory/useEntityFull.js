/**
 * Reads the complete public entity payload.
 *
 * The admin router has write routes for menus, drinks, happy hour, specials,
 * and events, but no per-entity GET for them. The public read model
 * (GET /api/gcr/entity/:slug) assembles all of it already — menu_sections
 * with nested items, drink_sections, happy_hour_sections, specials, events,
 * sections, and the profile collections — so that is the read path, and the
 * admin routes are the write path.
 *
 * That endpoint is edge-cached for 2 minutes, so `reload` appends a
 * cache-buster to make a fresh read after a write actually fresh.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { endpoints } from '../../api/endpoints.js';

export function useEntityFull(slug) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(slug));
  const [error, setError] = useState(null);
  const bust = useRef(0);

  const load = useCallback(
    async ({ fresh = false } = {}) => {
      if (!slug) {
        setData(null);
        setLoading(false);
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        if (fresh) bust.current += 1;
        const payload = await api.get(endpoints.entities.publicDetail(slug), {
          auth: false,
          query: bust.current ? { _: bust.current } : undefined,
        });
        setData(payload);
        return payload;
      } catch (err) {
        setError(err);
        setData(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => load({ fresh: true }), [load]);

  return { data, loading, error, reload: refresh };
}

export default useEntityFull;
