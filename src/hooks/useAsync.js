/**
 * Data-fetching hooks.
 *
 * Deliberately small — the dashboard is read-then-refetch, not a cache-heavy
 * app, so this covers the whole surface without pulling in a query library.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Run an async function on mount and whenever `deps` change.
 *
 * @returns {{data, error, loading, reload, setData}}
 */
export function useAsync(fn, deps = [], { immediate = true, initialData = null } = {}) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const mounted = useRef(true);
  const runId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (...args) => {
    const id = ++runId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fn(...args);
      // Ignore results from a superseded run so fast typing can't race.
      if (mounted.current && id === runId.current) setData(result);
      return result;
    } catch (err) {
      if (mounted.current && id === runId.current) setError(err);
      throw err;
    } finally {
      if (mounted.current && id === runId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!immediate) return;
    run().catch(() => {
      // Error already captured in state; swallowing keeps the console clean.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, immediate]);

  return { data, error, loading, reload: run, setData };
}

/**
 * A one-shot async action with its own loading/error state — used for saves,
 * deletes, imports, and other button-triggered work.
 */
export function useAction(fn) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (...args) => {
      setLoading(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (err) {
        if (mounted.current) setError(err);
        throw err;
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [fn],
  );

  return { run, loading, error, clearError: () => setError(null) };
}

/** Debounce a rapidly changing value (search boxes). */
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Persist a value in localStorage (used for theme, sidebar state, filters). */
export function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initialValue : JSON.parse(raw);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable — the value still works for this session.
    }
  }, [key, value]);

  return [value, setValue];
}
