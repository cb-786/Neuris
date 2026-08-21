/** Presentation helpers. Pure functions, no side effects. */

export function formatLatency(ms) {
  if (ms == null || Number.isNaN(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`;
}

export function formatCount(n) {
  if (n == null || Number.isNaN(n)) return '—';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function formatScore(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return null;
  return score.toFixed(3);
}

export function formatClock(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatSeconds(s) {
  if (typeof s !== 'number' || Number.isNaN(s)) return '—';
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** Two-letter initials for the avatar. */
export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic badge tone per entity name, so colours stay stable across renders. */
const TONES = ['accent', 'blue', 'violet', 'green', 'amber'];
export function toneFor(key = '') {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return TONES[hash % TONES.length];
}

/** Human label for a diarization speaker tag. */
export function speakerLabel(speaker) {
  if (speaker == null) return 'Speaker';
  const s = String(speaker);
  return /^\d+$/.test(s) ? `Speaker ${s}` : s;
}

export function pluralize(n, singular, plural) {
  return n === 1 ? singular : plural ?? `${singular}s`;
}
