import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../api/api';
import { graphFromContext, graphFromExport, mergeGraphs } from '../lib/graph';
import { getEntries, sessionContexts, subscribe } from '../lib/session';

/**
 * The user's memory graph, from whichever real sources are available.
 *
 * Two sources, merged:
 *   1. GET /api/v1/graph — everything stored in Neo4j.
 *   2. The grounding subgraphs carried on this session's retrieval responses.
 *
 * The second exists because the first is newer than the rest of the API. On a
 * backend without /graph the endpoint 404s and this falls back to session data
 * alone, which is thinner but still entirely real — and `source` says which
 * happened so the UI can be honest about what it is showing.
 */
export function useMemoryGraph({ limit = 250, enabled = true } = {}) {
  const [stored, setStored] = useState(null);
  const [status, setStatus] = useState(enabled ? 'loading' : 'idle');
  const [error, setError] = useState(null);
  const [sessionTick, setSessionTick] = useState(0);
  const abortRef = useRef(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('loading');
    setError(null);

    try {
      const payload = await api.graph(limit, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setStored(graphFromExport(payload?.data ?? {}));
      setStatus('ready');
    } catch (err) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return;
      setStored(null);
      if (err instanceof ApiError && err.status === 404) {
        // Older backend: not an error the user needs to see, just less data.
        setStatus('unsupported');
      } else {
        setError(err);
        setStatus('error');
      }
    }
  }, [limit]);

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    return () => abortRef.current?.abort();
  }, [enabled, load]);

  // Re-derive when a capture or recall lands, so the space grows as you use it.
  useEffect(() => subscribe(() => setSessionTick((t) => t + 1)), []);

  const session = useMemo(
    () => graphFromContext(sessionContexts()),
    // sessionTick is the dependency: sessionContexts() reads a module-level store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionTick]
  );

  const graph = useMemo(() => {
    if (stored && stored.nodes.length) return mergeGraphs(stored, session);
    return session;
  }, [stored, session]);

  const source = stored?.nodes?.length
    ? session.nodes.length
      ? 'both'
      : 'stored'
    : session.nodes.length
      ? 'session'
      : 'empty';

  return {
    graph,
    stored,
    session,
    source,
    status,
    error,
    truncated: Boolean(stored?.truncated),
    sessionEntries: getEntries(),
    refresh: load,
  };
}
