/**
 * Bind a resource (src/api/createResource.js) to component state.
 *
 * Gives a section list + create + update + delete with loading/error handling
 * and toast reporting, in one call. This is why a typical section module is
 * ~40 lines of descriptor instead of a few hundred lines of fetch plumbing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../ui/Toast.jsx';

export function useResource(resource, { params, query, auto = true, labelFor } = {}) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(auto);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Serialized so object literals passed inline don't retrigger every render.
  const paramsKey = useMemo(() => JSON.stringify(params ?? null), [params]);
  const queryKey = useMemo(() => JSON.stringify(query ?? null), [query]);

  const describe = useCallback(
    (row) => (typeof labelFor === 'function' ? labelFor(row) : row?.name || row?.title || 'Record'),
    [labelFor],
  );

  const reload = useCallback(async () => {
    if (!resource?.spec?.listPath) {
      setLoading(false);
      return [];
    }
    setLoading(true);
    setError(null);
    try {
      const data = await resource.list({ params, query });
      if (mounted.current) setRows(data);
      return data;
    } catch (err) {
      if (mounted.current) {
        setError(err);
        setRows([]);
      }
      return [];
    } finally {
      if (mounted.current) setLoading(false);
    }
    // paramsKey/queryKey stand in for deep comparison of params/query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, paramsKey, queryKey]);

  useEffect(() => {
    if (!auto) return;
    reload();
  }, [auto, reload]);

  /** Create or update depending on whether the row carries an id. */
  const save = useCallback(
    async (values) => {
      setSaving(true);
      try {
        const result = await resource.save(values, { params });
        toast.success(`${describe(values)} saved.`);
        await reload();
        return result;
      } catch (err) {
        toast.error(err);
        throw err;
      } finally {
        if (mounted.current) setSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resource, paramsKey, reload, toast, describe],
  );

  const remove = useCallback(
    async (row) => {
      const id = row?.[resource.idField] ?? row;
      setSaving(true);
      try {
        await resource.remove(id, { params });
        toast.success(`${describe(row)} deleted.`, 'Deleted');
        await reload();
      } catch (err) {
        toast.error(err);
        throw err;
      } finally {
        if (mounted.current) setSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resource, paramsKey, reload, toast, describe],
  );

  return { rows, loading, error, saving, reload, save, remove, setRows };
}

export default useResource;
