/**
 * Thin fetch wrapper over the NEURIS FastAPI backend.
 *
 * Every call returns parsed JSON and throws an ApiError on non-2xx or network
 * failure, so callers only ever handle one error shape.
 */

import { getApiBase } from '../lib/config';

export class ApiError extends Error {
  constructor(message, { status = 0, detail = null, url = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.url = url;
  }
}

/** FastAPI returns `detail` as a string, or a list of validation objects. */
function readDetail(payload) {
  if (!payload) return null;
  const d = payload.detail ?? payload.message;
  if (!d) return null;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) {
    return d.map((e) => e.msg || JSON.stringify(e)).join('; ');
  }
  return JSON.stringify(d);
}

async function request(path, { method = 'GET', body, headers, signal, timeoutMs = 60000 } = {}) {
  const url = `${getApiBase()}${path}`;

  // Compose an abort signal that fires on either the caller's signal or timeout.
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      // Distinguish an explicit caller cancel from our own timeout.
      if (signal?.aborted) throw err;
      throw new ApiError(`Request timed out after ${Math.round(timeoutMs / 1000)}s.`, { url });
    }
    throw new ApiError(
      'Cannot reach the NEURIS backend. Check that it is running and that the API URL is correct.',
      { url }
    );
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }

  const text = await res.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!res.ok) {
    // A bare 5xx with no body usually means the API process is down or the
    // reverse proxy could not reach it, so say something actionable.
    const fallback =
      res.status >= 500
        ? `The backend returned ${res.status}. It may be down, still starting, or unable to reach Neo4j/Redis.`
        : `Request failed with status ${res.status}.`;

    throw new ApiError(readDetail(payload) || fallback, {
      status: res.status,
      detail: payload,
      url,
    });
  }

  return payload;
}

const json = (data) => ({
  body: JSON.stringify(data),
  headers: { 'Content-Type': 'application/json' },
});

export const api = {
  /** Liveness probe. Also used by the connection indicator. */
  health: (opts) => request('/health', { timeoutMs: 8000, ...opts }),

  /** POST /api/v1/conversations/ingest — text turn through the full pipeline. */
  ingestText: (text, opts) =>
    request('/api/v1/conversations/ingest', { method: 'POST', ...json({ text }), ...opts }),

  /**
   * POST /api/v1/conversations/ingest/audio — server-side STT + diarization.
   * `blob` is whatever MediaRecorder produced; the filename hints the codec.
   */
  ingestAudio: (blob, language = 'en-US', opts) => {
    const form = new FormData();
    const ext = (blob.type || '').includes('ogg') ? 'ogg' : 'webm';
    form.append('audio', blob, `capture.${ext}`);
    form.append('language', language);
    return request('/api/v1/conversations/ingest/audio', {
      method: 'POST',
      body: form,
      timeoutMs: 120000,
      ...opts,
    });
  },

  /** GET /api/v1/search/rag — retrieval without writing a conversation turn. */
  searchRag: (q, opts) =>
    request(`/api/v1/search/rag?q=${encodeURIComponent(q)}`, opts),

  /** GET /api/v1/memories — 50 most recent extracted memories. */
  memories: (opts) => request('/api/v1/memories', opts),

  /**
   * GET /api/v1/graph — stored nodes and edges for the Memory Space view.
   *
   * Newer than the rest of the API, so a 404 here means the backend predates
   * the endpoint rather than that anything is broken. Callers fall back to the
   * subgraph carried on retrieval responses.
   */
  graph: (limit = 250, opts) => request(`/api/v1/graph?limit=${limit}`, opts),

  /** GET /api/v1/analytics/summary — aggregate event counters. */
  analyticsSummary: (opts) => request('/api/v1/analytics/summary', opts),
};
