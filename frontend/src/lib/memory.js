/**
 * Helpers for presenting the /api/v1/memories payload.
 *
 * Reality check on that payload: the background pipeline writes
 * `summary = "Extracted N nodes and M edges."` (see background_tasks.py), so
 * `summary` is extraction telemetry, NOT a human title. The real memory is
 * `content` (the transcript). These helpers present that honestly instead of
 * showing a debug string where a title belongs.
 */

const EXTRACTION_RE = /^\s*Extracted\s+(\d+)\s+nodes?\s+and\s+(\d+)\s+edges?\.?\s*$/i;

/**
 * Recognises the pipeline's telemetry string.
 * Returns `{ nodes, edges }`, or null when `summary` is genuine prose (which
 * is what a future backend change would produce - handled without edits here).
 */
export function parseExtraction(summary) {
  if (typeof summary !== 'string') return null;
  const match = summary.match(EXTRACTION_RE);
  if (!match) return null;
  return { nodes: Number(match[1]), edges: Number(match[2]) };
}

/** True when `summary` is real prose worth showing as a heading. */
export function hasProseSummary(memory) {
  const s = memory?.summary;
  return typeof s === 'string' && s.trim().length > 0 && !parseExtraction(s);
}

/**
 * The line to lead a memory card with.
 *
 * Prefers a real summary; otherwise falls back to the opening sentence of the
 * stored transcript. Both are real stored data - nothing is invented.
 */
export function memoryLead(memory) {
  if (hasProseSummary(memory)) return memory.summary.trim();

  const content = (memory?.content ?? '').trim();
  if (!content) return 'Empty memory';

  // First sentence, but only if it is a reasonable heading length.
  const sentence = content.split(/(?<=[.!?])\s+/)[0] ?? content;
  if (sentence.length >= 12 && sentence.length <= 130) return sentence;
  return content.length > 130 ? `${content.slice(0, 130).trimEnd()}...` : content;
}

/** Remainder of the transcript after the lead line, for card body copy. */
export function memoryBody(memory) {
  const content = (memory?.content ?? '').trim();
  if (!content) return '';
  if (hasProseSummary(memory)) return content;

  const lead = memoryLead(memory);
  if (content.startsWith(lead)) {
    return content.slice(lead.length).trim();
  }
  return content;
}

export function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "just now" / "12m ago" / "3h ago" / "Yesterday" / "12 Aug". */
export function formatRelative(value) {
  const date = parseDate(value);
  if (!date) return null;

  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const daysApart = Math.floor((startOfToday.getTime() - date.getTime()) / 86400000);

  if (daysApart < 1) return 'Yesterday';
  if (daysApart < 6) {
    return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(date);
}

export function formatAbsolute(value) {
  const date = parseDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

const BUCKETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'Earlier this week' },
  { key: 'month', label: 'Earlier this month' },
  { key: 'older', label: 'Older' },
];

function bucketFor(date) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.floor((startOfToday.getTime() - date.getTime()) / 86400000);
  if (days < 0) return 'today';
  if (days < 1) return 'yesterday';
  if (days < 7) return 'week';
  if (days < 31) return 'month';
  return 'older';
}

/**
 * Groups memories into date buckets, newest bucket first.
 * Returns null when the payload carries no usable timestamps, so callers can
 * fall back to a flat list rather than inventing dates.
 */
export function groupByDate(memories) {
  const dated = memories.filter((m) => parseDate(m.created_at));
  if (!dated.length) return null;

  const map = new Map(BUCKETS.map((b) => [b.key, []]));
  const undatedItems = [];

  for (const memory of memories) {
    const date = parseDate(memory.created_at);
    if (!date) {
      undatedItems.push(memory);
      continue;
    }
    map.get(bucketFor(date)).push(memory);
  }

  const groups = BUCKETS.filter((b) => map.get(b.key).length > 0).map((b) => ({
    key: b.key,
    label: b.label,
    items: map.get(b.key),
  }));

  if (undatedItems.length) {
    groups.push({ key: 'undated', label: 'No timestamp', items: undatedItems });
  }
  return groups;
}

export const SORT_MODES = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'longest', label: 'Longest first' },
];

export function sortMemories(memories, mode) {
  const list = [...memories];
  switch (mode) {
    case 'oldest':
      return list.sort(
        (a, b) => (parseDate(a.created_at)?.getTime() ?? 0) - (parseDate(b.created_at)?.getTime() ?? 0)
      );
    case 'longest':
      return list.sort((a, b) => (b.content?.length ?? 0) - (a.content?.length ?? 0));
    case 'newest':
    default:
      return list.sort(
        (a, b) => (parseDate(b.created_at)?.getTime() ?? 0) - (parseDate(a.created_at)?.getTime() ?? 0)
      );
  }
}

/** Rough reading time, used as a lightweight density cue on cards. */
export function wordCount(memory) {
  const content = (memory?.content ?? '').trim();
  if (!content) return 0;
  return content.split(/\s+/).length;
}
