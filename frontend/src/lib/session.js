/**
 * What NEURIS has seen during this browser session.
 *
 * Everything stored here is a real ingest/retrieval response the app already
 * received — transcripts, diarized speakers, referenced entities and the
 * grounding subgraph. Nothing is synthesised.
 *
 * Why keep it at all: the backend exposes `/memories` (text only, no speakers)
 * and `/graph` (nodes only, no transcript), so the tie between a spoken turn,
 * who was in it, and which part of the graph it touched exists only on the
 * ingest response. Holding those responses lets Capture, People and Memory
 * Space show real speaker attribution instead of dropping it on the floor.
 *
 * Scoped to sessionStorage: this is a working set, not a second database, and
 * it must not outlive the tab that produced it.
 */

const KEY = 'neuris.session.v1';
const LIMIT = 60;

let entries = load();
const listeners = new Set();

function load() {
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* private mode or quota — the in-memory copy still works */
  }
}

function emit() {
  for (const listener of listeners) listener(entries);
}

let seq = 0;

/**
 * Records one ingest response.
 * `kind` is 'capture' (a conversation was stored) or 'recall' (a question was
 * asked) — the backend runs the same pipeline for both, but only capture adds
 * to memory, and the UI must not blur that line.
 */
export function recordTurn({ kind, query, response, source = 'text' }) {
  const transcript = response?.transcript ?? null;
  const ai = response?.ai_response ?? response?.data ?? {};

  seq += 1;
  const entry = {
    id: `${Date.now().toString(36)}-${seq}`,
    at: new Date().toISOString(),
    kind,
    source,
    query: query ?? null,
    text: transcript?.full_text ?? query ?? '',
    segments: Array.isArray(transcript?.segments) ? transcript.segments : [],
    speakerCount: transcript?.speaker_count ?? null,
    answer: ai?.response ?? '',
    entities: Array.isArray(ai?.entities) ? ai.entities : [],
    context: Array.isArray(ai?.context_used) ? ai.context_used : [],
    conversationId: response?.conversation_id ?? null,
    latencyMs: response?.latency_ms ?? null,
    cached: Boolean(response?.cached),
  };

  entries = [entry, ...entries].slice(0, LIMIT);
  persist();
  emit();
  return entry;
}

export function getEntries() {
  return entries;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearSession() {
  entries = [];
  persist();
  emit();
}

/** Every grounding subgraph seen this session, for merging into Memory Space. */
export function sessionContexts() {
  return entries.map((entry) => entry.context).filter((c) => c.length > 0);
}

/**
 * Speakers observed in diarized transcripts, with the turns they appeared in.
 *
 * Diarization returns tags like "Speaker 1" — real, but not identities. The
 * People view labels them as detected voices for exactly that reason.
 */
export function sessionSpeakers() {
  const map = new Map();

  for (const entry of entries) {
    if (entry.kind !== 'capture') continue;
    for (const segment of entry.segments) {
      const name = String(segment?.speaker ?? '').trim();
      if (!name) continue;

      let person = map.get(name);
      if (!person) {
        person = { name, segments: 0, words: 0, turns: new Set(), firstAt: entry.at, lastAt: entry.at };
        map.set(name, person);
      }
      person.segments += 1;
      person.words += String(segment.text ?? '').trim().split(/\s+/).filter(Boolean).length;
      person.turns.add(entry.id);
      if (entry.at > person.lastAt) person.lastAt = entry.at;
      if (entry.at < person.firstAt) person.firstAt = entry.at;
    }
  }

  return [...map.values()]
    .map((p) => ({ ...p, conversations: p.turns.size, turns: undefined }))
    .sort((a, b) => b.segments - a.segments);
}
