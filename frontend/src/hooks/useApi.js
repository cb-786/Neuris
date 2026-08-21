import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async fetcher and tracks loading/error/data.
 *
 * `immediate: false` turns it into a manual trigger (used by Search, where a
 * request should only fire when the user submits).
 */
export function useApi(fetcher, { immediate = true, deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(immediate));
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  // Keep the latest fetcher without making it a dependency of `run`, so callers
  // can pass an inline arrow function without causing an effect loop.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const run = useCallback(async (...args) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const result = await fetcherRef.current(...args, { signal: controller.signal });
      if (!mountedRef.current || controller.signal.aborted) return null;
      setData(result);
      return result;
    } catch (err) {
      if (err?.name === 'AbortError' || !mountedRef.current) return null;
      setError(err);
      return null;
    } finally {
      if (mountedRef.current && !controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (immediate) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, error, loading, run, reset, setData };
}
